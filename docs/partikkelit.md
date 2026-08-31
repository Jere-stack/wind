# Partikkelit ja ruutubudjetti

Tuulipartikkelien simulaatio ja piirto, jäljen muoto, tiheys, sekä se mihin
ruutuaika oikeasti menee.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

## Sujuvuus — mitattu, ei arvattu

Kaikki alla oleva on mitattu Chromiumissa **4× CPU-kuristuksella**, DPR 3,
390×844. Se approksimoi puhelinta muttei ole iOS Safari — kompositiota
koskevat löydökset ovat Chromiumin, ja Safari voi käyttäytyä toisin.

### Juurisyy: sekoituskerros canvasin alla

Partikkelicanvas on lämpökartan **päällä**, ja lämpökartalla on
`mix-blend-mode: plus-lighter` ja `filter: blur()`. Jokainen canvasin muutos
pakottaa selaimen sekoittamaan koko kerroksen uudelleen.

**Kustannus on suhteessa canvasin pikselimäärään, ei siihen mitä siihen
piirretään.** Mitattu ablaatio: canvasiin ei kosketa 60 fps → **2×2
pikselin kirjoitus 20 fps** → koko ruudun täyttö 20 fps → häivytys +
kaikki viivat 17 fps. Pelkkä likaantuminen maksaa ~33 ms.

Kustannus jakautuu kahtia: `filter` 18 → 34 fps, `mix-blend-mode`
34 → 60 fps. Kumpaakaan ei voi poistaa — sekoitus on rantaviivan kontrasti
(20,1 → 41,5, katso lämpökartan luku).

**Mikään CSS-eristys ei auta.** Kokeiltu ja mitattu tehottomaksi:
`will-change: transform`, `translateZ(0)`, `isolation: isolate`,
`contain: strict` canvasille; `contain: paint`, `will-change`,
`isolation` tilePanelle; `contain: layout paint` kartalle. `contain: paint`
Leafletin paneelilla näytti 61 fps — mutta paneelin laatikko on 0×0, joten
se leikkasi koko kartan pois. Nopeus ilman kuvaa ei ole nopeutta.

Siksi ainoa vipu on **pikselimäärä**: partikkelicanvas piirretään enintään
2× tarkkuudella (2,96 → 1,32 Mpx). Lepotila 19 → 24 fps.

### Partikkelit pysyvät kartalla — ja jatkavat liikettään

Tästä on tehty kolme versiota, ja kaksi ensimmäistä olivat väärin:

1. Raahaus **jäädytti** partikkelit, himmensi canvasin 25 %:iin ja pyyhki
   sen lopuksi. Jäljet katosivat ja koko kenttä syntyi uudelleen.
2. Valmista bittikarttaa **siirrettiin CSS-muunnoksella** eleen ajan.
   Jäljet pysyivät maastossa, mutta liike pysähtyi silti — canvasiin ei
   piirretty mitään koko eleen aikana. Eleen jälkeen kenttä rakennettiin
   uusiksi, ja siinä meni noin 15 ruutua ennen kuin liike näytti
   jatkuvan. Juuri tämä tuntui viiveeltä.

Kumpikin osti nopeutta lopettamalla animaation. Nyt liike ei katkea
missään vaiheessa, ja se maksaa saman kuin versio joka animoi mutta ei
pysynyt maastossa.

**Perusta: partikkelit ovat jo lat/lng-koordinaateissa.** Vain piirto on
sidottu ruutuun. Kentän vaihtuessa ne ovat siis yhä oikeissa paikoissaan —
`resetParticles()` ei enää tyhjennä canvasia eikä arvo kenttää uusiksi,
vaan sovittaa pelkän lukumäärän. Tyhjennys tapahtuu vain kun canvasin
sisältö on oikeasti pätemätön (ikkunan koon muutos, asennon vaihto).

Kartta liikkuu kahdella tavalla, ja ne vaativat eri ratkaisun
(`KanvasSiirto`):

- **Siirto** (raahaus, inertia, `setView`): bittikarttaa siirretään joka
  ruudussa sen verran kuin kartta liikkui, ja uudet pätkät piirretään
  nykyiseen projektioon. Siirto pyöristetään kokonaisiin laitepikseleihin
  ettei kuva sumene, ja pyöristyksen jäännös kannetaan seuraavaan ruutuun
  ettei pitkässä raahauksessa kerry ryömintää.
- **Zoom** (rulla, tuplanapautus, napit, nipistys): mittakaava muuttuu, ja
  bittikartan skaalaus 60 kertaa sekunnissa sotkisi jäljet puuroksi.
  Siksi zoomin ajaksi **ruudusto jäädytetään** ja canvas venytetään
  CSS-muunnoksella — bittikarttaan ei kosketa, se skaalautuu
  kompositoinnissa kerran ruudussa. Simulaatio jatkuu jäädytetyssä
  ruudustossa, joten jäljet venyvät maaston mukana ja liike jatkuu. Kun
  zoom on ohi, muunnos paistetaan kerran bittikarttaan.

#### CSS-muunnos kelpaa vain suurentamaan

Tämä oli seuraava vika. CSS-muunnos liikuttaa canvasin **suorakulmiota**,
joten alle yhden mittakaava kutistaa canvasin ruutua pienemmäksi eikä
reunoille jää mitään. Mitattuna kolmen zoom-tason nipistys ulos kuristi
partikkelikerroksen ruudun pinta-alasta **100 % → 54 % → 22 % → 4 % → 2 %**.
Kartan reunat olivat tyhjät ja keskellä oli suorakulmio partikkeleita.

Sääntö on siis: **pidä sisältö siinä ruudustossa jossa muunnos suurenee.**

| ele | sisältö | canvas |
|---|---|---|
| siirto | nykyisessä ruudustossa | ei muunnosta (bittikartta siirtyy) |
| zoom sisään | lähtöruudustossa | 1 → s, paistetaan lopuksi |
| zoom ulos, animoitu | paistetaan heti maaliruudustoon | 1/s → 1 |
| zoom ulos, nipistys | paistetaan joka ruudussa nykyiseen | ei muunnosta |

Ulospäin animoidussa zoomissa canvas kulkee siis **käänteismuunnoksesta
identiteettiin**: se aloittaa suurennettuna eikä käy hetkeäkään ruutua
pienempänä. Siirtymä on sama kuin karttatasoilla, ja koska selain
interpoloi sen, omaa pehmennyskäyrää ei tarvitse mallintaa. Peitto on
mitattuna **100 % kaikissa eleissä ja kaikissa vaiheissa**.

Nipistyksessä maalia ei tiedetä, joten ulospäin sisältö paistetaan joka
ruudussa. Se maksaa saman kuin raahaus — yksi koko canvasin veto
ruudussa — ja mitattuna nipistyksen ruutunopeus ei eronnut edellisestä
versiosta (13–15 fps ulos, 14 sisään, 4× kuristuksella).

Asiat jotka eivät ole ilmeisiä:

- **Nipistyksen CSS-muunnosta ei saa paistaa seuraavassa ruudussa.**
  Animaation päätyttyä muunnos pitää paistaa, mutta nipistyksen muunnos
  elää yli ruutujen ja päivittyy joka ruudussa. Kun molemmat kulkivat
  saman lipun kautta, nipistys sisäänpäin paistoi joka ruudussa: mittaus
  näytti canvasin skaalan jäävän arvoon 1,20 vaikka ele oli 3,8-kertainen,
  ja ruutunopeus putosi 15:stä 11:een. Siksi `_animoitu` erottaa nämä.

- **Leaflet valehtelee animaation ajan.** `zoomanim` syttyy ennen kuin
  kartan tila hyppää maaliin, ja heti sen jälkeen `getZoom()` ja
  `latLngToContainerPoint()` kertovat jo maalin — vaikka kuva on vasta
  lähdössä ja karttatasoja venytetään 0,25 s CSS-siirtymällä. Siksi
  lähtötila on luettava juuri siinä tapahtumassa, ja canvasille annetaan
  sama siirtymä (`transform .25s cubic-bezier(0,0,.25,1)`).
- **`transform-origin: 0 0` on pakollinen.** Muunnos lasketaan ruudun
  vasemmasta ylänurkasta kuten Leafletillä; oletusorigo (keskellä)
  skaalaisi väärästä kohdasta.
- **Nipistys ei ole animaatio.** Siinä Leaflet siirtää karttaa suoraan
  joka ruudussa murtoluku-zoomilla, eikä `_animatingZoom` ole päällä.
  Ele tunnistetaan Leafletin omasta `pinch`-lipusta (`map.on('zoom')`).
  Ilman sitä samaan haaraan päätyisi myös kertaloikka (`setView`), jonka
  `zoomend` on jo ehtinyt tapahtua — canvas jäisi pysyvästi venytetyksi.
  Tämä oli oikeasti rikki: mittaus näytti canvasin skaalan jämähtäneen
  arvoon 32.
- **Yli kahden zoom-tason venytystä ei paisteta** vaan canvas
  tyhjennetään: kuva olisi pelkkää puuroa, ja jäljet syntyvät takaisin
  puolessa sekunnissa.
- **Häivytys ja siirto ovat sama veto.** `copy` korvaa kohteen lähteellä,
  ja `globalAlpha` kertoo lähteen läpinäkyvyydellä — tulos on sama kuin
  erillinen `destination-in`-häivytys. Se säästää yhden koko canvasin
  läpikäynnin joka ruudussa, mikä on tässä se mikä maksaa (katso yllä:
  likaantuminen ~33 ms). **Mitattuna vetoele 19 → 26 fps.**
- **Rajat ja zoom luetaan `GeoProject`ista, ei kartalta.** Silmukan on
  nähtävä kartta yhtenä johdonmukaisena tilana: jos rajat luettaisiin
  animaation aikana suoraan kartalta, partikkelit syntyisivät uudelleen
  eri projektiossa kuin missä ne piirretään.

**Mitattu, 4× kuristus, DPR 3, vetoele:** versio joka jäädytti 53 fps,
versio joka animoi muttei pysynyt maastossa 27 fps, **tämä 26 fps**. Eli
maastossa pysyminen on käytännössä ilmaista; hinta tulee animoinnista,
joka on koko pointti. Lepotila on ennallaan (16 fps molemmissa).

**Mitattu kiinnitys.** Testi maalaa laikun tunnettuun koordinaattiin ja
katsoo joka askeleen jälkeen, onko laikku yhä siinä mihin koordinaatti
projisoituu: **100 % kahdeksalla askeleella ja inertian läpi.** Zoomissa
verrataan Leafletin omaan zoom-animoituun merkkiin: ero **≤ 1,9 px** koko
animaation ajan, ja se on `GeoProject`in lineaarisen approksimaation
oma virhe (kontrollimittaus antaa saman luvun ilman canvasia).

**Liike ei pysähdy kertaakaan.** Ruutu ruudulta mitattuna 60 partikkelin
otoksesta: raahauksessa, zoomissa, nipistyksessä ja heti eleiden jälkeen
**0 jäätynyttä ruutua** — aiemmin zoomissa niitä oli 12 peräkkäin.

#### Tiheys ei ole ylläpidettävä asia vaan määritelmä

Tässä meni kolme kierrosta väärään suuntaan, ja kannattaa tietää miksi.

Partikkelit elivät **lat/lng-koordinaateissa**. Ajatus on houkutteleva —
partikkeli "on" kartalla — mutta se tekee tiheydestä näkymän funktion:
ulos zoomatessa sama joukko kattaa kahdeksasosan ruudusta, eikä mikään
palauta sitä. Mitattuna kolmen zoom-tason nipistys jätti 32 ruutulohkoa
36:sta tyhjäksi, ja luonnollinen uusiutuminen vei siitä viisi sekuntia.

Sitä paikattiin kolmella perättäisellä koneistolla — ruutukohtainen
pinta-alasääntö, sama sääntö leikkauksen sisältä laskettuna, ja lopuksi
kertatasaus 4×4 ruudukolla eleen lopussa. Jokainen paransi mittaria,
eikä yksikään korjannut syytä. Paras niistä jäi 1,16–1,42-kertaiseksi
satunnaisjakaumaan nähden.

**Partikkeli on nyt ruutupiste (x, y).** Silloin tasainen tiheys ei ole
ylläpidettävä asia vaan määritelmä: uusi partikkeli arvotaan tasaisesti
ruudulta. Tuuli haetaan kääntämällä ruutupiste koordinaatiksi — yksi
kerto- ja yhteenlasku suuntaa kohti. Sama rakenne on Cameron Beccarion
`earth`-projektissa ja siitä johdetuissa (Windy, leaflet-velocity).

Koko tasauskoneisto poistui. Tilalle jäi yksi sääntö:

> **Canvasin sisältö ja partikkelit ovat aina samassa ruudustossa.**

Kun bittikarttaa muunnetaan `(s, tx, ty)`:llä, samat luvut ajetaan
partikkeleille (`siirraPartikkelit`). Ruutukoordinaateissa myös se mitä
näkymän muutos vaatii on eksakti eikä arvio: edellinen ruutu on nyt
suorakulmio `[tx, ty, tx+sW, ty+sH]`, paljastunut alue on ruutu miinus
se, ja sinne kuuluu `N × paljastunutAla / ala` partikkelia. Ne otetaan
ensin niistä jotka valuivat reunan yli.

Tästä seuraa oikea käytös kaikissa eleissä ilman erikoistapauksia:

- **Raahauksessa** reunan yli valuneiden määrä on tasan se minkä
  paljastunut kaista tarvitsee, joten ylimääräisiä ei siirretä eivätkä
  jäljet lyhene.
- **Ulos zoomatessa** reunan yli ei valu ketään ja kehä saa `N(1−s²)`
  partikkelia — tasan se määrä joka pitää tiheyden ennallaan.
- **Sisään zoomatessa** paljastunutta alaa ei ole, ja reunan yli menneet
  arvotaan tasaisesti koko ruudulle.

Kaksi kohtaa joihin kompastuin ja jotka mittaus paljasti:

- **Siirrettävät on otettava kutistuneen laatikon sisältä**, ei mistä
  tahansa. Muuten osa osumista menee jo valmiiksi paljastuneelle
  alueelle, laatikko jää liian tiheäksi ja kehä liian täyteen —
  nipistyksessä kenttä jäi kaksi kertaa epätasaisemmaksi kuin
  satunnaisjakauma.
- **Täydennys ei saa arpoa takaisinpanolla.** 118 arvontaa 120
  partikkelista osuu vain noin 75 eri partikkeliin, joten loput jäävät
  paikalleen. Sama oire, sama mittaustulos.

**Mitattu (CV/Poisson, 1,0 = yhtä tasainen kuin arvottu):**

| ele | ennen | nyt |
|---|---|---|
| lepo | 1,10 | 1,11–1,29 |
| zoom ulos 1 taso | 1,40 | **0,89–1,19** |
| zoom ulos 3 tasoa | — | **0,92–1,14** |
| nipistys ulos | 1,42 | **0,92–1,25** |
| raahaus | — | **0,97–1,13** |

Tyhjiä ruutulohkoja on 0 kaikissa eleissä 400 ms:n kuluttua, ja
peittävyys 100 % koko ajan.

#### Partikkelit kuuluvat NÄKYVÄLLE alueelle, ei sisältöruudustoon

Ruutukoordinaatteihin siirtyminen ei yksin riittänyt. Partikkelit
arvottiin ja karsittiin sisällön ruudustoon — mutta canvasilla voi olla
CSS-muunnos, jolloin vain osa sisällöstä on ruudulla. Sisään
nipistettäessä näkyvien määrä romahti **120:stä seitsemään** (keskiarvo
41), eli kenttä käytännössä tyhjeni juuri silloin kun sitä katsottiin.

Se ei näkynyt mittareissa, koska mittarini laski partikkelit sisällön
ruudustossa. **Mittari oli väärässä koordinaatistossa, ei sovellus.**
Sen jälkeen kun mittaus vietiin canvasin CSS-muunnoksen läpi, vika näkyi
ensimmäisellä ajolla.

- `State.alue` on näkyvä alue sisällön koordinaateissa: CSS-muunnoksen
  käänteiskuva ruudusta. Sitä käyttävät sekä `respawn` että silmukan
  rajatarkistus, joten koko budjetti on aina siellä missä se näkyy.
- **Näkyvä alue voi muuttua ilman että sisältöä muunnetaan.** Nipistys
  sisään `maxZoom`in yli pomauttaa lopuksi takaisin, ja silloin
  partikkelit jäivät siihen pieneen laatikkoon joka oli näkyvissä eleen
  huipulla: 27 ruutulohkoa 36:sta tyhjänä, eikä tilanne korjaantunut
  itsestään. Siksi tasaus vertaa **näkyvän alueen** muutosta
  (`AlueVahti`), ja sisällön muunnos vain siirtää muistissa olevaa
  edellistä aluetta mukanaan.
- **CSS-siirtymän aikana muunnos elää selaimen käsissä**, joten alue
  luetaan siltä ruutu ruudulta. Ilman sitä alue hyppäsi maaliin heti ja
  näkyviä oli 0,25 s ajan 44/120.

**Mitattu ruudun läpi** (CV/Poisson, 1,0 = yhtä tasainen kuin arvottu):

| ele | CV/Poisson | näkyvissä | tyhjiä lohkoja 400 ms:n jälkeen |
|---|---|---|---|
| lepo | 1,09–1,18 | 98–99 % | 0–1 |
| zoom ulos 1 taso | 0,93–1,13 | 98–99 % | 0–1 |
| zoom ulos 3 tasoa | 0,92–1,15 | 98–100 % | 0 |
| nipistys ulos | 1,00–1,35 | 99–100 % | 0 |
| nipistys sisään | 0,93–1,12 | 90–100 % | 0 |
| raahaus | 0,90–1,34 | 98–99 % | 0 |

#### Jälki on geometriaa, ei pikseleitä

Klassinen tapa piirtää tuulipartikkeleita on jättää jäljet canvasille ja
häivyttää koko kuvaa vähän joka ruudussa. Se on halpaa ja näyttää
hyvältä — kunnes karttaa zoomataan. Silloin valmis bittikartta pitäisi
venyttää uuteen mittakaavaan, ja 2–4-kertainen venytys muuttaa ohuet
viivat **turvonneiksi palloiksi**. Kiertoteitä kokeiltiin kolme
(jäädytys, CSS-venytys, paisto bittikarttaan) ja jokainen kaatui samaan
asiaan, koska jälki oli tallessa vain pikseleinä.

Nyt jokainen partikkeli muistaa oman polkunsa: 20 viimeisintä paikkaa,
joka neljäs ruutu. Canvas tyhjennetään joka ruudussa ja polut piirretään
uudelleen nykyiseen muunnokseen. Siitä seuraa neljä asiaa:

- **Mitään ei koskaan venytetä.** Zoomissa jälki on yhtä terävä kuin
  levossa.
- **Canvasille ei tarvita CSS-muunnosta**, joten se peittää aina koko
  ruudun eikä kutistu reunoilta. Koko `_css`/`paista`/bittikartan
  paisto -koneisto poistui.
- **Jäljen pituus on suora luku** (`JALKI × ASKEL` = 80 ruutua) eikä
  häivytysvakion sivutuote. `FADE_OPACITY` poistui.
- **Ruutunopeus kaksinkertaistui.** 4× kuristuksella, DPR 3: 12 → 24 fps
  levossa. Syy on se, että canvas on nyt enimmäkseen tyhjä: häivytettävä
  kuva piti koko ruudun verran mustetta, jonka sekoituskerros joutui
  laskemaan joka ruudussa uudelleen.

Zoom-animaation ajan kartan tila on jo maalissa mutta kuva vasta
matkalla. Siihen ei tarvita omaa pehmennyskäyrää: **`#c-wind-kello` on
näkymätön elementti jolla on sama CSS-siirtymä kuin karttatasoilla**, ja
siltä luetaan joka ruudussa se muunnos jossa kartta juuri nyt näkyy.
Selain hoitaa easingin, me luemme tuloksen.

#### Jälki on kapeneva nauha, ei pino vetoja

Häivytystä yritettiin kahdesti vedoilla, ja molemmat kaatuivat samaan
asiaan: **veto on paksu ja sillä on päät.**

1. *Segmentti kerrallaan, kullakin oma alfa.* Näytti helmiketjulta —
   segmentti on lyhyempi kuin viivan leveys, joten pyöreät päät jäävät
   päällekkäin ja vierekkäiset alfat tekevät niistä erillisiä pisaroita.
2. *Kolme sisäkkäistä vetoa* eri pituudella, leveydellä ja alfalla.
   Tämä luettiin pitkään "komeetaksi", mutta lähikuva kertoi muuta:
   **kolme pyöreäpäistä kapselia päällekkäin**. Leveämmän kirkkaan vedon
   pyöreä pää työntyi kapeamman himmeän yli, ja alfa vaihtui portaana
   kahdessa kohtaa. Kovassa tuulessa pisteitä oli vain yhdeksän
   viidenkymmenen pikselin matkalla, joten polylinja oli myös
   särmikäs. Yhdessä ne lukivat makkarajonona.

Kumpaakaan ei saa pois alfaa tai leveyttä säätämällä, koska **vika on
muodossa**. Nyt jälki on yksi täytetty monikulmio: polun ympärille
lasketaan reunaviiva, jonka puolileveys kapenee kärjestä hännän nollaan.

- **Päätyjä ei ole**, joten mikään ei työnny minkään yli.
- **Alfa on vakio koko jäljellä** eikä portaita synny. Häivytys tulee
  muodosta: kapeneva nauha vie vähemmän mustetta hännässä, ja
  additiivisessa sekoituksessa se lukee himmenemisenä.
- **Reunat ovat käyriä.** Pisteiden puolivälien kautta kulkeva
  neliöllinen käyrä maksaa saman määrän polkukomentoja kuin suora
  jakso, ja poistaa juuri sen särmikkyyden joka luki "pikselinä".
- **Piirtokutsuja on 10 eikä 30**, koska tasoja on yksi.

Kolme yksityiskohtaa jotka eivät ole ilmeisiä:

- **Kapeneminen on `1 − t²`, ei `1 − t`.** Se on tasainen kärjessä
  (derivaatta nolla). Kärkeen tulee pyöristys, ja jos leveys kapenee
  heti sen takaa, pää pullistuu nauhan yli ja jäljelle jää **väkänen**.
  Tasainen alku sulattaa pyöristyksen nauhaan.
- **Kärki pyöristetään puoliympyrällä.** Ilman sitä nauha alkaa
  kohtisuoralla katkaisulla juuri siinä kohdassa mihin katse menee.
- **Normaali lasketaan naapuripisteiden erotuksesta**, jolloin mutkassa
  reuna kääntyy pehmeästi eikä nurkkaa synny.

Mitattu peitto ruudusta (tasainen kenttä, z9):

| m/s | kolme vetoa | nauha |
|---|---|---|
| 4 | 2,3 % | 2,5 % |
| 12 | 16,8 % | 11,1 % |
| 20 | 21,1 % | 14,4 % |

Nauha on kevyempi kovassa tuulessa mutta ei heikossa — juuri se mitä
haettiin. Leveys ja alfa laskettiin samalla (`2,5 + 2,7·t` ja alfakatto
0,50), koska täytetty muoto on tiiviimpi kuin kolme osittain
päällekkäistä vetoa: ilman laskua yksittäinen jälki luki umpinaisena
teränä (musteen keskiarvo 77 → 93).

#### Isompi ja harvempi lukee paremmin kuin ohut ja tiheä

Ensimmäinen tiheys oli noin 310 hiukkasta 390×844 ruudulla (`ala / 1050`),
ja se valittiin ruutunopeudella: 227 antoi 24 fps, 451 antoi 14 fps, 313
antoi 18–19 fps. Ruutunopeus ei kuitenkaan kerro erottuuko jälki.

Mittari joka kertoo: **luettava peitto** = osuus ruudusta jossa on
partikkelimustetta, jonka kontrasti *omaan taustaansa* on vähintään 1,5.
Se rankaisee molemmista suunnista — liian ohut jää kontrastin alle, liian
harva ei kerrytä peittoa. Pyyhkäisy niin että mustemäärä pysyy vakiona
(leveys ylös, määrä alas samassa suhteessa):

| leveys | n | luettava peitto | näkymätöntä |
|---|---|---|---|
| ×1,00 | 313 | 2,95 % | 12 % |
| ×1,25 | 251 | 3,27 % | 11 % |
| **×1,50** | **209** | **3,55 %** | **9 %** |
| ×1,80 | 174 | 3,39 % | 9 % |

Optimi on ×1,50 ja se on aito huippu, ei pyyhkäisyn reuna. Syy on
antialiasointi: ohut viiva menettää huippualfansa osittaiseen peittoon,
paksu ei. Sama muste luettavampana — ja kolmannes vähemmän partikkeleita
on myös halvempi piirtää. Kaksi kierrosta DPR 3:lla ja 4× kuristuksella,
313 → 219 hiukkasta: **levossa 19/17 → 23/21 fps**, vetoeleessä
18/17 → 18/20 fps.

**Nämä kaksi kuuluvat yhteen.** Jos toista muuttaa yksinään, mustemäärä
muuttuu ja pyyhkäisyn tulos ei enää päde.

Nykyarvot ovat `particleLineWidth` = `2,15 + ms/MAX_MS × 2,3` ja tiheys
`ala / 1500`. Leveys on siis noin 15 % ohuempi kuin yllä mitattu optimi:
se on **tietoinen poikkeama ulkoasun hyväksi**, tehty pyynnöstä koska
paksu veto näyttää kartalla raskaalta. Mitattuna se ei maksanut
luettavuutta, koska määrä palautui samaan aikaan täyteen maa/vesi-rajauksen
poiston myötä: **luettava peitto 3,98 %** (153 hiukkasta), eli yli taulukon
parhaan 3,55 %:n. Jos määrä joskus laskee, ohennus alkaa purra — mittaa
uudelleen ennen kuin ohennat lisää.

#### Jäljen pituus rajataan ruudulla, ei ruuduissa

Jälki oli vakiomittainen ajassa: `JALKI × ASKEL` = 80 ruutua liikettä.
Silloin sen pituus **ruudulla** on suoraan nopeus × 80, eli kovassa
tuulessa monikerta siitä mitä heikossa. Mitattuna tasaisella kentällä
z9:llä, sama hiukkasmäärä:

| m/s | jälki px | muste px² | peitto ruudusta |
|---|---|---|---|
| 4 | 23,8 | 6 717 | 2,35 % |
| 12 | 73,7 | 77 395 | 19,44 % |
| 20 | 101,8 | 132 808 | **30,87 %** |

Kolmannes ruudusta täynnä viivaa. Myrsky ei näyttänyt kovalta tuulelta
vaan sotkulta, koska yksittäinen jälki ei erottunut naapureistaan.

Kolme asiaa kasvaa nopeuden mukana yhtä aikaa — pituus 4,3×, leveys
1,7× ja alfa 2,2× — eli mustetta on kärjessä noin 16-kertaisesti.
Leveyttä ja alfaa ei voi laskea, koska ne ovat juuri se mikä tekee
yksittäisestä jäljestä luettavan (ks. edellinen luku), ja tausta on
kovassa tuulessa kirkkaimmillaan. Pituus on ainoa joka saa kylläistyä.

`JALKI_MAX_PX` on pyyhkäisty:

| raja | 4 m/s | 12 m/s | 20 m/s | suhde 20/4 |
|---|---|---|---|---|
| ei rajaa | 2,35 % | 19,44 % | 30,87 % | 13,1× |
| 80 px | 2,17 % | 18,14 % | 23,07 % | 10,6× |
| **62 px** | **2,28 %** | **16,75 %** | **21,10 %** | **9,3×** |
| 45 px | 2,34 % | 14,31 % | 16,33 % | 7,0× |

62 px valittiin koska se **ei kosketa heikkoa tuulta lainkaan** (2,35 →
2,28 %, eli raja puree vasta noin 8 m/s yläpuolella) mutta leikkaa
kärjestä kolmanneksen. 45 px veisi pidemmälle, mutta silloin 12 ja
20 m/s ovat pituudeltaan käytännössä sama (40,7 ja 39,7 px) — nopeuden
kolmesta vihjeestä yksi katoaisi.

Toteutus on jaolasku liikesilmukassa: pisteet ovat `nopeus × ASKEL`
pikselin päässä toisistaan, joten rajaan mahtuva määrä on suoraan
`JALKI_MAX_PX / (nopeus × ASKEL)`.

#### Lyhennys osuu eri nopeuksiin eri kautta

Jälki oli yhä liian pitkä, ja lyhennys piti tehdä **kahdesta suunnasta
kerralla**, koska ne purevat eri nopeuksiin:

- **Heikossa tuulessa pituuden ratkaisee aika**, `JALKI × ASKEL`
  ruutua. Katto ei purista siellä lainkaan.
- **Kovassa tuulessa pituuden ratkaisee katto** `JALKI_MAX_PX`.

Vain toista säätämällä toinen pää jäisi ennalleen. Katto laskettiin
62 → 46 px ja aikaperustainen pituus 80 → 60 ruutuun.

**Aikapituus lyhennettiin askelta pienentämällä, ei pisteitä
vähentämällä**, vaikka `15 × 4` ja `20 × 3` antavat saman 60 ruutua.
Ensimmäinen yritys oli `15 × 4`, ja kovassa tuulessa jälkeen jäi silloin
**6,6 pistettä**: rajaan mahtuva määrä on `raja / (nopeus × ASKEL)`, eikä
pistemäärän vähentäminen vaikuta siihen mitenkään. Niin harvasta hilasta
nauhan reunaan tuli näkyvä nykäys. Askeleella 3 samaan 46 pikseliin
mahtuu 8,4 pistettä ja reuna on sileä.

Tiheämpi talletus ei maksa mitään mitattavaa. Molemmat variantit ajettiin
samassa vertailussa: ruutumäärät olivat 37–52 kummallakin, eikä ero
erottunut kohinasta. Välissä ehdittiin epäillä että `ASKEL 3` ohentaisi
kenttää — hiukkasmäärä valui 212:sta 102:een pitkän ajon aikana — mutta
**sama valuminen tapahtui myös `15 × 4` -variantilla**. Se on
`PerfTracker`in normaalia sopeutumista tässä kontissa, ei tämän
muutoksen aiheuttamaa.

#### Sileys irrotettiin pistemäärästä

Katto laskettiin vielä 46 → 32 px, ja silloin 18 m/s jälkeen jäi taas
**6,6 pistettä** ja nykäys palasi. Sama seinä siis vastaan uudestaan:
talletusväli on `nopeus × ASKEL`, joten mitä lyhyempi jälki, sitä
harvempi hila — ja askeleen pienentäminen edelleen olisi lyhentänyt myös
heikkoa tuulta, jota ei haluttu lyhentää enempää.

Nykäys ei kuitenkaan johdu siitä montako pistettä on **talletettu** vaan
siitä montako kertaa **kapeneminen näytteistetään**. Nauha tihennetään
nyt piirtovaiheessa: raakapisteiden väliin lasketaan lisänäytteitä
kunnes niitä on vähintään `NAUHA_MIN` (14), sijainti lineaarisesti ja
leveys jatkuvasta kaavasta. Portaat katoavat, ja **sileys ei enää riipu
siitä montako pistettä pituusrajaan sattuu mahtumaan** — katon saa nyt
säätää vapaasti ilman että muoto hajoaa.

Tihennys tehdään vain kun sitä tarvitaan: jos raakapisteitä on jo
tarpeeksi, `osat` on 1 eikä mitään lasketa turhaan.

Jäljen pituus kovassa tuulessa lopulta:

| | 18 m/s | 10 m/s |
|---|---|---|
| kolmen vedon pino | 52 px | 47 px |
| nauha, katto 46 | 41 px | 41 px |
| **nauha, katto 32 + tihennys** | **28 px** | **30 px** |

### Partikkelit kirkastavat kenttää, eivät peitä sitä

Partikkeli piirrettiin samalla rampin värillä kuin lämpökartta samassa
nopeudessa — eli **omaa taustaansa vasten**. Mitattuna ruudulta (sama
kuva partikkelien kanssa ja ilman, luminanssiero pikseleittäin):

| | ennen | nyt |
|---|---|---|
| kontrasti omaan taustaan, mediaani | 1,30 | **1,72** |
| alle 1,15 (käytännössä näkymätön) | **26 %** | 10 % |
| alle 1,30 | 50 % | 22 % |
| ylin | 2,32 | 4,21 |

Kaksi muutosta, molemmat sovelluksessa jo käytössä olevaa kieltä:

- **`mix-blend-mode: plus-lighter` partikkelicanvasille.** Sama perustelu
  ja sama varatie kuin lämpökartalla: additiivisena jokainen veto nostaa
  luminanssia, joten jälki erottuu aina.
- **Väri vaalennetaan kohti valkoista** (30 % hännässä, 58 % kärjessä).
  Additiivinen sekoitus yksin ei riitä, koska tummat sävyt lisäävät
  vähän. Rampin sävy kertoo yhä nopeuden, mutta luminanssi nousee
  taustan yli — ja kärki on vaaleampi kuin häntä, jolloin jälki lukee
  suuntansa.

### Nopea sivuvieritys — kolme kerrosta, kolme ennakointia

Kun karttaa heittää sivulle, uutta aluetta paljastuu reunalta nopeammin
kuin mikään kerros ehtii reagoida. Kaikki kolme kerrosta odottivat ennen
samaa asiaa — että jotain on **jo** puuttunut ruudulta — ja lähtivät
vasta sitten liikkeelle. Nyt kaikki kolme katsovat eteenpäin.

Mittausasetelma: 700 px heitto 450 ms:ssa (sama minkä Leafletin inertia
tekee), 180 ms verkkoviive laatoille, näytteet joka ruudulla.

#### 1. Pohjakartta: esihaku kulkusuuntaan

Leafletin oletus `updateWhenIdle` on **mobiililaitteella tosi**, eli
laattoja ei haeta lainkaan liikkeen aikana. Oletus on ajalta jolloin
laattojen purku nykäisi vierityksen. Sen kanssa terävä laattapeitto oli
eleen aikana 45 % ja palasi täydeksi vasta 685 ms kuluttua — siihen asti
puolet ruudusta oli venytettyä isovanhempaa eli sumeaa.

Leaflet hakee tasan sen mitä on näkyvissä juuri nyt, ei laattaakaan
enempää. Tavallinen kiertotie on hakea yksi rengas joka suuntaan; se
auttaa, mutta maksaa 56 % enemmän pyyntöjä **joka kerta kun näkymä
vaihtuu**, myös silloin kun karttaa ei vieritetä — kolme neljäsosaa
renkaasta on aina väärällä puolella.

Tässä pehmuste annetaan vain sinne minne ollaan menossa, ja vain kun
kartta liikkuu. **Paikallaan olevan kartan kustannus on tasan nolla.**

| | terävä peitto eleen aikana | täysi vasta |
|---|---|---|
| Leafletin oletus | 45 % | 685 ms |
| `updateWhenIdle: false` | 56 % | 487 ms |
| rengas joka suuntaan | 76 % | 508 ms |
| **esihaku kulkusuuntaan** | **62–70 %** | **460–476 ms** |

Suunta luetaan kartan keskipisteen siirtymästä pikseleinä. Zoomin aikana
vertailukohta on eri mittakaavassa, joten silloin pehmustetta ei anneta
lainkaan — eikä tarvitakaan, koska zoomatessa uutta aluetta paljastuu
joka puolelta eikä suunnalla ole merkitystä.

Toteutus korvaa `_pxBoundsToTileRange`-metodin laattatasolla. Se on
Leafletin sisusta, joten korvaus asennetaan vain jos metodi on olemassa
— muuten kartta toimii tasan kuten ennenkin, ilman esihakua.

#### 2. Lämpökartta: rakennus alkaa ennen kuin reuna paljastuu

Kate-tarkistus oli **vain zoomissa**. Sivulle vieritettäessä lämpökartta
jäi sinne mihin se oli rakennettu: mitattuna yksi nopea heitto jätti
30 % ruudusta värittämättä, eikä tilanne korjaantunut itsestään
lainkaan — vain uusi datahaku olisi rakentanut tekstuurin uudelleen, ja
sillä on oma kynnyksensä.

Kolme korjausta:

- **Sama kate-tarkistus siirrolle.** Neljä vertailua kehyksessä.
- **Pehmuste mitoitetaan näkymän mukaan** eikä vakiona: puolikas aste on
  z9:llä puoli ruutua mutta z13:lla kymmenen ruutua, eli lähellä turhaa
  työtä ja kaukana liian vähän.
- **Rakennus alkaa ennakkoon.** `_heatmapCovers(0,35)` kysyy "onko reuna
  *paljastumassa*", ei "onko reuna jo paljastunut". Ilman tätä
  lämpökartan kate putosi 66 %:iin heitossa, koska rakennus hävisi kisan
  laattojen lataukselle — nyt se on **100 % joka näytteessä**.

#### 3. Ennustedata: haku lähtee kesken eleen

Data haettiin vasta kun ele oli ohi ja sen päälle odotettiin 350 ms —
koko ele siis kului odottaen, ja vasta sen jälkeen alkoi sekunnin
mittainen haku. Nyt haku lähtee heti kun näkymä on liikkunut tarpeeksi,
sormi kartalla tai ei: mitattuna haku alkaa **1 958 ms kohdalla eikä
3 205 ms kohdalla**, eli 1,25 s aiemmin. Kaksi vartijaa pitää sen
järkevänä: `loadViewport` peruu
edellisen keskeneräisen pyynnön, joten liian tiheä laukaisu estäisi
kaiken valmistumisen — siksi kesken eleen vaaditaan puolen ruudun
siirtymä ja vähintään 600 ms edellisestä.

**Tässä kaatui myös hypoteesi.** Näytti siltä että vierityksen jälkeen
näkymässä oli vain 5 ennustepistettä 12:sta eikä tilanne korjaantunut.
Suoraan mitattuna kaikki 49 pyydettyä pistettä olivat ladattuina,
näkymän neljä hilapistettä mukaan lukien. Ero oli **spoteissa**:
Helsingin edustalla niitä on näkyvissä kahdeksan, idempänä yksi. Datan
lataus ei ollut rikki lainkaan.

#### Karkea tekstuuri oli velkaa jota kukaan ei perinyt

Eleen aikaiset kiinniottorakennukset ovat karkeita (`SCRUB_STEP` 6), ja
zoomille tarkan version palauttaa `zoomend`. Siirrolla ei ollut
vastaavaa. Kun kate-tarkistus laajennettiin siirtoon, syntyi tilanne
jossa karkea tekstuuri jäi ruudulle **toistaiseksi**: ainoa muu tarkka
rakennus on datahaun perässä, eikä se laukea pienessä siirrossa.

`WindTexture.askel` kertoo nyt millä tarkkuudella ruudulla oleva
tekstuuri on laskettu, ja `moveend` rakentaa tarkan version jos velkaa
on. Mitattuna: heiton aikana askel 6, 600 ms kuluttua takaisin 3, kate
100 % koko ajan — myös pienessä siirrossa joka ei ylitä datahaun
kynnystä.

`_hmPending` on samalla muutettu totuusarvosta **askeleeksi**: eleen
aikana pyydetään karkeaa ja pysähdyttäessä tarkkaa, ja jos molemmat
osuvat samaan jonoon, tarkempi voittaa. `WindTexture.build` kirjoittaa
jaettuja kenttiä (`cols`, `latMin`, …), joten kahta rakennusta ei saa
olla lennossa yhtä aikaa.

### Mihin ruutuaika oikeasti menee

Mitattu DPR 3:lla ja 4× CPU-kuristuksella. **Ympäristön pohja
tarkistettiin ensin:** tyhjä sivu samassa kontissa antaa 17 ms / 60 fps,
ja täyden ruudun canvas jota tyhjennetään joka ruutu antaa myös 17 ms.
Luvut ovat siis sovelluksen, eivät kontin.

**Mikä EI ole kallista** — jokainen mitattu erikseen, ero ≤ 3 ms eli
kohinaa:

| kytkin pois | vaikutus |
|---|---|
| lämpökartan `filter: blur() saturate()` | ei mitään |
| lämpökartta kokonaan piiloon | ei mitään |
| `mix-blend-mode` kummallakaan kerroksella | ei mitään |
| `clearRect` täydelle DPR 3 -canvasille | ei mitään |
| `isMarine`, `SpatialIndex.build` | 0,1 ms |

Aiempi arvaus että sekoituskerros olisi juurisyy **ei päde**. Se
mitattiin kerran kumulatiivisilla kytkimillä, jolloin peräkkäiset
muutokset kasautuivat samaan lukuun. Riippumattomasti mitattuna
sekoitus on ilmainen.

**Mikä on kallista:**

- **Partikkelivetojen piirto.** Eristettynä (219 hiukkasta, 30 vetoa,
  60 px jäljet): DPR 3 → 65 ms, DPR 2 → 47 ms. Kustannus on suoraan
  verrannollinen jäljen kokonaispituuteen ruudulla — sama syy kuin
  `JALKI_MAX_PX`:n takana. Kevyessä tuulessa (21 px jäljet) sama joukko
  maksaa vain 13 ms.
- **Tekstuurin rakennus**, ks. seuraava luku.

Tästä seuraa että **lepotilan ruutuaika on koko sovelluksen katto**:
kaikki eleet kulkevat sen päällä. Ainoa jäljellä oleva vipu siihen on
partikkelicanvasin resoluutio, ja se on ulkonäkökysymys eikä
suorituskykykysymys — sitä ei saa ratkaista mittaamalla yksin.

### Kentän rakennus: kaksi mitattua optimointia

`WindTexture.build` oli 45 ms (300×300, askel 3, 4× kuristus). Se ajetaan
joka datahaun jälkeen, joka eleen kiinniotossa, joka aikajanan
askeleella ja joka play-tunnilla — aikajanaa raahatessa 18 kertaa 2,5
sekunnissa.

**1. Väri ja alfa yhtenä 32-bittisenä hakuna.** Täyttösilmukka ajoi
jokaiselle 90 000 pikselille `ColorRamp.rgb()`:n ja alfakaavan
(`Math.exp` + kuutio) — mitattuna 4,5 + 4,6 ms. Ramppi on jo valmiiksi
kvantisoitu 0,1 m/s välein, joten alfan vieminen samaan hilaan ei muuta
kuvaa: ero on korkeintaan 0,002 alfayksikköä, ja päälle ajetaan vielä
3–22 px sumennus. `pikseliLUT()` pakkaa värin ja alfan 201-alkioiseksi
`Uint32Array`ksi, jolloin täyttö on yksi luku ja yksi kirjoitus neljän
sijaan. **Tavujärjestys tarkistetaan ajossa** — kanvaspuskuri on
RGBA-tavuina ja pakkautuu eri järjestyksessä little- ja
big-endian-koneilla.

**2. idw-painot talteen kun kartta on paikallaan.** Painot riippuvat
vain geometriasta: hilasolmujen ja ennustepisteiden sijainneista.
Aikajanaa raahatessa kartta ei liiku lainkaan — vain arvot vaihtuvat —
ja silti sama naapurihaku, `isMarine` ja etäisyyslaskenta ajettiin 18
kertaa. `IdwPainot` tallettaa normalisoidut painot ja tekee jatkossa
pelkän painotetun summan.

Talletusajo on kalliimpi kuin tavallinen rakennus (64 ms vs 23 ms),
joten se kannattaa vain jos sama geometria toistuu vielä monta kertaa.
Kaksi ehtoa, molemmat mitattuja:

- **Kolme peräkkäistä osumaa.** Kahdella osumalla riitti että kaksi
  eleen aikaista kiinniottorakennusta sattui samoihin rajoihin, ja
  talletus maksettiin väärässä paikassa: raahauksen rakennukset
  nousivat 110 ms:stä 163 ms:iin ja eleen jälkeiseen ruutuun tuli
  62 ms:n rakennus. Aikajanan raahauksessa rakennuksia on 18 ja
  play'ssä yli 30, joten kolmas osuma tulee heti eikä hyöty siirry.
- **Vain paikallaan olevalla kartalla.** Liikkeessä geometria vaihtuu
  joka tapauksessa, eikä välimuistille ole käyttöä.

Indeksit osoittavat siihen taulukkoon josta `SpatialIndex` on rakennettu,
ja `SpatialIndex.wf` tarkistetaan ennen kuin painoja luetaan tai
talletetaan — muuten eri taulukolla rakennettu indeksi osoittaisi väärään
pisteeseen.

**Tulos** (300×300, askel 3, 4× kuristus):

| | ennen | nyt |
|---|---|---|
| peräkkäiset ajot samalla geometrialla | 45 ms | 23 → *64* → 25 → **11 → 11 → 11** |
| vaihtuva geometria (ele) | 45 ms | **16–21 ms** |

Kertaluontoinen 64 ms on talletusajo. Vaihtuvan geometrian hyöty tulee
kokonaan hakutaulusta.

**Tarkistettu alkio alkiolta.** Suora laskenta ja välimuistista luettu
antavat saman `msData`:n ja `uData`:n (ero 0 kuudella desimaalilla), ja
90 000 pikselistä **yksi** eroaa yhden LUT-lokeron eli 0,1 m/s verran.
Syy on liukulukujen summausjärjestys: suora tie laskee `su/sw`, luettu
tie summaa valmiiksi normalisoidut painot, eikä liukulukuyhteenlasku ole
assosiatiivinen. Yksi pikseli 90 000:sta 3–22 px sumennuksen alla ei ole
havaittavissa. Sama tarkistus ajettiin myös muuttuneella kentällä
(kertoimet 1,37 ja 0,61): siinä ero oli 0 pikseliä.

### Työ pois eleen päältä

Kaksi erää joita ei tarvitse tehdä juuri silloin kun sormi liikkuu.

**Kentän rakennus odottaa liikkeen loppuun.** Ennakoiva datahaku lähtee
kesken eleen (ks. edellä), ja sen valmistuttua koko ketju —
`buildWindField` + `drawColorField` + `resetParticles` — ajettiin siinä
ruudussa mihin lataus sattui osumaan. Mitattuna raahauksessa
`buildWindField` oli 28–65 ms ja koko ketju kasautui yhteen 125–214 ms:n
ruutuun. Data on jo muistissa; ainoa mitä siirtäminen maksaa on että
väritys päivittyy vasta kartan pysähtyessä, ja sitä varten on oma
kiinniottonsa. `State.liikkeessa` kertoo tilan, ja velka maksetaan
`moveend`issä.

**Aikajana ei rakenna DOMia uusiksi turhaan.** `renderTimeline` tyhjensi
`#tl-scroll`in ja loi noin 370 elementtiä joka kutsulla — mitattuna
**27–43 ms**. Heiton pahimmassa ruudussa (214 ms) se oli suurin
yksittäinen erä, ja siinä kahdesti.

Ensin kokeiltiin muistiota: ohita jos lähdedata on sama olio. **Se ei
riittänyt** — vieritettäessä kartan keskipiste vaihtuu, jolloin lähin
ennustepiste on oikeasti eri ja data siis eri. Mittaus näytti sen
suoraan: `updateTimelineToCenter` oli yhä 40 ms, kahdesti.

Oikea havainto on että **rakenne tulee aikaleimoista, ei arvoista**.
Montako tikkiä, mihin päiväerottimet ja NYT-viiva osuvat, mitkä tunnit
saavat nimikyltin — kaikki tulee `times`-taulukosta, ja kaikki
ennustepisteet tulevat samasta mallista samalla tuntiruudukolla. Vain
palkin korkeus ja väri muuttuvat. Nopea tie päivittää ne paikallaan ja
jättää DOMin koskematta.

Ehtoihin kuuluu **NYT-indeksi**: "mennyt"-tila on sidottu siihen ja se
siirtyy kellon mukana, joten tunnin vaihtuessa on rakennettava kokonaan.
Muistio päivitetään `renderTimeline`ssä eikä kutsujassa, jotta myös sen
kolme suoraa kutsujaa pitävät sen ajan tasalla.

Mitattuna `updateTimelineToCenter` **40 ms → 0–8 ms**, ja heiton
pahimmat ruudut 218/263/196 ms → **129/161/113 ms**.

#### Mikä jäi jäljelle

Pahimmissa ruuduissa on nyt kaksi erää: `WindTexture.build` 21–37 ms
(pohja johon välimuisti ei pure, koska ele vaihtaa geometrian) ja
ruutuja joissa **ei ole yhtään instrumentoitua työtä** mutta jotka
kestävät 110–161 ms. Jälkimmäinen on partikkelien piirtoa ja selaimen
omaa työtä. Se on sama katto joka näkyy lepotilassa.

### Aikajana ja play

Mittarit 4× kuristuksella ovat tarkoituksella pessimistisiä: **tyhjä
sivu samassa kontissa on 17 ms**, eli kuristus on kolmen vuoden takaisen
puhelimen karkea vastine. Sama mitattuna 2×:llä, joka vastaa
lähemmin nykylaitetta:

| | 4× | 2× |
|---|---|---|
| aikajanan raahaus | 15 fps / 69 ms | **50 fps / 20 ms** |
| play | 19 fps / 53 ms | **40 fps / 25 ms** |

Toiminnallisesti: loksahdus janan keskelle 0 px, play'n tuntivälit
788–831 ms (tavoite 800), ja janaan tarttuminen pysäyttää playn.

**Aikajanan raahaus on lepotilan pohjaan sidottu, ei kentän työhön.**
Yksi askel maksaa 4× kuristuksella noin 19 ms — `WindTexture.build`
11 ms (välimuisti puree, 19 osumaa 22:sta) ja `drawColorField` 6 ms —
mutta lepotilan ruutu on 48 ms. Kentän työn puolittaminenkaan ei siis
muuttaisi ruutunopeutta olennaisesti; siihen tarvittaisiin
partikkelicanvasin resoluutio, joka on ulkonäkökysymys.

### Kerrokset samassa paikassa, samaan aikaan

"Kartan eri layerit päivittyvät eri aikaan" oli oikea havainto, mutta
syy ei ollut ajoituksessa.

**Mittari pitää rakentaa oikein.** Ensimmäinen versio vertasi jokaista
kerrosta `map.latLngToContainerPoint`iin. Se on väärä totuus: eleen
aikana Leaflet on jo maalitilassa vaikka ruudulla on vielä lähtötila,
joten mittari näytti 33–628 px eroja siellä missä kerrokset olivat
keskenään tarkalleen kohdallaan. Toimiva mittari lukee **jokaisen
kerroksen oman renderoidyn suorakulmion** (`getBoundingClientRect`) ja
kysyy mihin kohtaan ruutua kukin piirtää saman koordinaatin:

- pohjakartta: se ladattu laatta joka kattaa pisteen, `_tileCoordsToBounds`
- lämpökartta: overlayn `<img>` + `getBounds()`
- partikkelit: `Ruudusto.m ∘ GeoProject`

Leveysasteen ja ruudun y:n välillä on Mercator, joten muunnos tehdään
`ln(tan(π/4 + φ/2))`-avaruudessa — muuten mittari itse tuottaa juuri sen
virheen jota etsitään.

**Lämpökartta oli koko ajan kunnossa** — 0,1–0,5 px pohjakartasta
kaikissa eleissä. Leafletin `ImageOverlay` hoitaa zoom-animaation itse,
eikä `setUrl`in asynkronisuudella ollut väliä (mediaani 9–13 ms).

**Partikkelikerros oli vinossa 4,0 px z9:llä ja 14,8 px z7:llä.**
`GeoProject` sovitti ruudun y:n suoraan leveysasteeseen:

    y = oy + (lat − north) · sy

Mercatorissa se on kaari, ei suora, ja lineaarisen sovitteen virhe on
suurimmillaan juuri ruudun keskellä. `(h²/8)·y″(φ)` ennustaa z9:lle
3,7 px ja z7:lle 14,7 px — eli mitatut luvut tasan. Virhe **riippuu
näkymän korkeudesta asteina**, joten se muuttuu zoomatessa: kenttä
liukui maastoon nähden joka kerta kun zoomia vaihdettiin. Se näyttää
ajoitusvirheeltä vaikka on projektiovirhe.

Korjattuna `project`/`lat` kulkevat Mercator-y:n kautta ja **ero on
0,0–0,5 px kaikissa eleissä**.

Kaksi asiaa jotka menivät samalla oikein:

- **Nopeuden pohjoiskerroin luettiin `_sy`:stä.** Se oli px astetta
  kohti; nyt `_sy` on px Mercator-yksikköä kohti eikä kelpaa
  nopeudeksi. Mercatorissa mittakaava on paikallisesti sama molempiin
  suuntiin, joten `ky = −kx` — mikä oli myös vanhan koodin arvo
  likimäärin, joten liike ei muuttunut.
- **`naytteista` käyttää samaa käänteiskuvaa.** Jos vain `project`
  korjattaisiin, partikkeli piirtyisi eri paikkaan kuin mistä se
  näytteistää tuulen.

#### Zoomista riippuva ulkoasu lähtee kartan mukana

Sumennuksen säde ja spottimerkkien koko riippuvat zoomista, ja
molemmat päivitettiin vasta `zoomend`issä. Kummallakin on oma
pehmennyksensä (0,30 s ja 0,32 s), joten ne lähtivät liikkeelle vasta
kun kartta oli jo pysähtynyt. Mitattuna (animoitu zoom, 3 tasoa,
hetket zoomin alusta):

| | ennen | nyt |
|---|---|---|
| zoom lähtee liikkeelle | +96 ms | +95 ms |
| sumennus maalissa | **+722 ms** | **+95 ms** |
| merkin skaala maalissa | **+400 ms** | **+247 ms** |

Sumennus asettui siis 370 ms *sen jälkeen* kun kartta oli jo
pysähtynyt — juuri silloin kun silmä on levossa ja huomaa sen.
Merkkien skaala on nyt maalissa täsmälleen kun kartan animaatio
päättyy, ei 150 ms myöhemmin.

Molemmat saavat maaliarvonsa `zoomanim`issa, eli heti animaation
alussa, ja muuttuvat kartan liikkeen alla. **Nipistyksessä ei**:
siinä `zoomanim` syttyy joka sormenliikkeellä ja arvon kirjoittaminen
uudelleen käynnistäisi siirtymän joka kerta. Leaflet erottaa nämä
`e.noUpdate`-lipulla — nipistyksessä se on tosi.

### Play liikkuu jatkuvasti, ei tunti kerrallaan

Play eteni ajastimella: se vieritti janan pehmeästi seuraavaan tikkiin ja
vasta kun vieritys pysähtyi (~300 ms) kenttä rakennettiin kerralla. Siitä
seurasi kolme vikaa, kaksi näkyvää ja yksi mitattava.

- **Kartta laahasi janan perässä** kolmanneksen sekunnin.
- **Play ohitti käyttäjän.** Se piti omaa laskuriaan, joten janaan
  tarttuminen kesken toiston ei pysäyttänyt sitä: mitattuna janaa
  vedettiin taaksepäin ja tunti eteni silti eteenpäin.
- **Koko tunnin työ osui yhteen ruutuun.** `WindTexture.build` on 57 ms
  neljän kertaluokan kuristuksella, eli nykäys joka askeleella.

Nyt sijainti on murtoluku, jana seuraa sitä ruutu ruudulta ja kenttä
päivitetään samalla koneistolla kuin sormella raahatessa: karkea tarkkuus
ja korkeintaan yksi rakennus lennossa. Kenttä **sulaa** tunnista toiseen
eikä hyppää.

- **Kynnys on eri sormella ja play'lla.** Sormea seuratessa kentän on
  oltava siinä missä sormi (0,02 h). Play etenee itse tasaisesti eikä
  kukaan vertaa sen sijaintia mihinkään, joten siellä riittää ~10
  rakennusta tuntiaskelta kohti (0,11 h). Partikkelit liikkuvat joka
  ruudussa joka tapauksessa, joten silmä ei näe eroa — mutta mittari
  näkee: ruutunopeus 26 → 31 fps ja pahin ruutu 83 → 50 ms.
- **Käyttäjä voittaa aina.** Kosketus janaan pysäyttää toiston.
- **Taustavälilehti pysäyttää toiston** (`visibilitychange`), muuten rAF
  nukkuisi ja play hyppäisi palatessa.
- Lopetettaessa valinta vahvistetaan lähimpään tuntiin täydellä
  tarkkuudella.

**Mitattu lopputulos:** tuntiaskel 787–826 ms (tasainen), pahin ruutu
50 ms — pienempi kuin alkuperäisen askeltavan version 67 ms. Aikajanan
loksahdus osuu **0,0 px** tarkkuudella oikeaan tuntiin.

### Kolme mitattua korjausta

1. **`SpatialIndex.nearby()` sai yhden alkion muistin.** Tulos riippuu vain
   solukoordinaateista, ja lämpökartan harva hila on säännöllinen ristikko:
   solu on 0,75° kun solmuväli on 0,012°, eli ~60 peräkkäistä solmua saa
   saman vastauksen. Ilman muistia jokainen varasi oman taulukkonsa ja
   kopioi samat 57 pistettä. Mitattu: `nearby` oli 38,3 ms `idw`:n
   50,1 ms:stä. **idw 58,8 → 20,2 ms (−66 %), tekstuurirakennus 83 → 45 ms.**
   Varmistettu bittitarkaksi: 10 201 solmua, **0 poikkeamaa**.

2. **Aikaleimat esilasketaan** (`_ts(h)`). `buildWindField` jäsensi
   `new Date(...)` 12 087 kertaa joka kutsulla, vaikka aikasarja ei muutu.
   **8,7 → 0,52 ms.** Välimuisti asuu `hourly`-oliossa ja katoaa
   luonnostaan kun data korvataan.

3. **Play ei enää rakenna kenttää kolmesti askelta kohti.** `scrollTimelineTo`
   vierittää pehmeästi, ja jokainen vieritystapahtuma laukaisi
   esikatselurakennuksen — ne ovat sormen seuraamista varten, mutta
   ohjelmallisessa vierityksessä määränpää on jo tiedossa. Lisäksi
   `_tlCommitSelection` rakensi kentän aina, myös kun tunti ei vaihtunut.
   **9 sekunnin play: 29 → 10 rakennusta, työ 1042 → 494 ms.**
   Käyttäjän kosketus aikajanaan nollaa lipun heti, joten raahaus toimii
   ennallaan.

### Lopputulos

| | ennen | jälkeen |
|---|---|---|
| Lepo, ruutuväli | 66,7 ms | 50 ms |
| Zoom, fps | 13 | 17 |
| Zoom, p95 ruutu | 166,6 ms | 100 ms |
| Play, fps | 11 | 16 |
| Play, p95 ruutu | 200 ms | 116,7 ms |

### Hypoteesit jotka mittaus kaatoi

Nämä näyttivät ilmeisiltä pullonkauloilta eivätkä olleet. Ei muutettu:

- **`canvas.toDataURL()`** joka lämpökartan päivityksessä: 5–7 ms. Epäilin
  synkronista PNG-pakkausta pääsyyksi; se on kohinaa.
- **Partikkeliviivat yksittäisinä `stroke()`-kutsuina**: 175 viivaa 0,5 ms.
  Niputus yhteen polkuun per väri säästäisi 0,07 ms.
- **`ColorRamp.css()`-merkkijonot** joka partikkelille joka ruudussa:
  0,04 ms.
- **Väriramppi tekstuurin täytössä**: 0,4 ms 24 ms:stä. LUT-taulukko ei
  kannata.
- **Häivytyksen `destination-in fillRect`** koko canvasin yli: 0,02 ms.
- **Canvasin rauhoittaminen eleen aikana**: ei mitattavaa hyötyä
  panoroinnissa eikä zoomauksessa.

## Partikkelit ovat tasaisia — maa/vesi-rajaus kokeiltiin ja poistettiin

Partikkelit arvotaan tasaisesti koko ruudulle. **Älä lisää maa/vesi-rajausta
uudelleen ilman että se on erikseen pyydetty** — se on jo kokeiltu ja
poistettu käyttäjän pyynnöstä, koska maan ja veden ero näkyi kartalla
häiritsevänä.

Mitä kokeiltiin: karkea maa/vesi-ruudukko luettuna pohjakartan pikseleistä
(näyte 8 ruudun välein, kynnys 56 — Esrin laatassa vesi on noin 35 ja maa
77), `respawn` arpoi uudelleen jos osuma tuli maalle, ja partikkelimäärä
skaalattiin veden osuudella jotta tiheys vedellä pysyi mitatussa
optimissaan.

Se toimi teknisesti: mitattuna saaristossa maata oli 30,5 % ruudusta ja
partikkelimusteesta maan päällä 11,1 % — tasaisella arvonnalla 30,5 %.
Ongelma oli esteettinen, ei tekninen: **kahden alueen ero luki kartalta
selvästi**, ja tuuli maan yllä on kuitenkin oikeaa dataa.

Poiston jälkeen mitattuna: maata 30,4 % ruudusta ja musteesta maalla 29,7 %,
eli jakauma on tasainen kuten pitääkin.

Kaksi asiaa jotka kannattaa tietää jos tähän joskus palataan:

- **Laattakerros tarvitsi `crossOrigin: true`**, muuten canvas saastuu ja
  `getImageData` heittää. ArcGIS palauttaa `Access-Control-Allow-Origin: *`.
  Asetus poistettiin maskin mukana, koska sillä ei ollut muuta käyttöä.
- **Maskin poistossa meni sormi suuhun tavalla joka on syytä muistaa.**
  Moduuli poistettiin skriptillä joka etsi lohkon lopuksi ensimmäisen
  `};`-esiintymän — ja se osui moduulin SISÄLLÄ olevaan riviin
  `const tiles = tileLayer._tiles || {};`. Loppuosa jäi irrallisiksi
  lauseiksi, ja sivu kaatui virheeseen "Illegal return statement".
  **`npm run build` meni läpi virheettä**, koska Vite ei jäsennä
  index.html:n inline-skriptiä. Vain selain huomasi. Kun tästä tiedostosta
  poistetaan lohkoja, tee se rivipohjaisesti (etsi rivi joka on tasan `};`)
  ja **lataa sivu selaimessa** — buildin läpimeno ei ole todiste mistään.


## Rakeisuus oli kahta eri vikaa

Kartta näytti rakeiselta sekä lämpökartan että partikkelien osalta.
Kerrokset erotettiin toisistaan piilottamalla toinen kerrallaan, ja
lähikuvat kertoivat että **ne olivat kaksi täysin eri vikaa** — sama oire,
eri syy. Ilman erottelua kumpi tahansa korjaus olisi näyttänyt
riittämättömältä.

### 1. Tekstuurin texelit olivat venyneitä, eivät liian harvoja

`maxDim` rajasi molempia sivuja **samalla luvulla**, ja koska näkymä on
pystysuora mutta katettu alue leveä, tekstuuri oli **neliö venytettynä
suorakulmioon**. Mitattuna uloimmassa näkymässä:

```
tekstuuri 260×260  ->  elementti 466×997 CSS px
yksi texel = 1,79 px leveä ja 3,83 px korkea  = 2,1x venynyt pystyyn
```

Ja sumennus mitoitetaan **pituuspiirin** texelistä, joten venyneellä
texelillä se kattoi vaakasuunnassa kaksi texeliä mutta pystysuunnassa
alle yhden — vaakaraidat jäivät näkyviin. Vika ruokki itseään.

Korjaus: **budjetti on texeleissä, muoto tulee näkymästä.** Sivut
lasketaan katetun alueen RUUTUKOOSTA (`latLngToLayerPoint`) tavoitteella
noin 2 CSS px / texel, ja jos tulo ylittää budjetin, molempia kutistetaan
samalla neliöjuurella — jolloin muotosuhde säilyy.

```
             ennen              jälkeen
uloin   1,79 × 3,83 px      2,49 × 2,49 px
z5      2,61 × 5,62         2,56 × 2,55
z8      4,51 × 9,41         5,88 × 5,88
```

Texel on nyt neliö joka zoomilla, ja sumennus osuu molempiin suuntiin
samalla tavalla.

**Uloin kaista on kalliimpi kuin texelmäärä antaa ymmärtää**, koska siellä
datapisteitä on eniten (1,25° hila laajalla alueella) ja jokainen
IDW-solmu maksaa enemmän. Mitattuna kylmällä polulla 4× kuristuksella
110 000 texeliä → 327 ms, 75 000 → 233 ms. Budjetti on siksi siellä
pienempi kuin lähempänä; texel 2,5 px on yhä selvästi sumennuksen (4 px)
alle, joten kuva ei muutu — vain aika.

### 2. Partikkelit olivat pilkkuja, koska jälki oli lyhyt

Lähikuva partikkelikerroksesta yksin näytti sen suoraan: lyhyitä pilkkuja
eikä virtaviivoja. Syy **ei** ollut pituusraja `JALKI_MAX_PX`, vaikka niin
olisi luullut. Pyyhkäisy:

```
maxPx    32    48    64    80
pituus  18,9  19,7  20,2  19,3 px      <- raja ei pure lainkaan
```

Heikossa tuulessa pituuden ratkaisee **aikapituus** (`JALKI × ASKEL`
ruutua) kerrottuna ruutunopeudella, ja ruutunopeus oli niin pieni ettei
raja tullut koskaan vastaan. Oikea vipu oli `GEO_SPEED`:

```
GEO_SPEED   0,0030  0,0045  0,0060
pituus px     19,9    28,4    34,3
peitto  %     2,33    3,25    3,73
```

Alle 20 px jälki lukee pilkkuna. 0,005 antaa noin 30 px ja peiton 3,4 %,
joka osuu talon omaan mitattuun optimiin (3,55 %, ks.
`particleLineWidth`). Samalla `JALKI` 20 → 30, jotta aikapituus riittää
myös heikkoon tuuleen.

**Peitto oli koko ajan ALLE mitatun optimin**, sekä vanhoilla että uusilla
arvoilla (2,3 % vs 3,55 %). Tiheyttä ei siis tarvinnut nostaa enempää —
partikkeleita on 401 ja se riittää, kun jälki on oikean mittainen.

**Mittausansa:** `resetParticles(kova)` kutsuu `PerfTracker.reset()`in,
joka palauttaa tavoitteen `nParticlesBase()`:iin. Määrää ei siis voi
pyyhkäistä asettamalla `_targetParticles` ja kutsumalla `resetParticles`
— jälkimmäinen kumoaa edellisen. Pyyhkäisyssä on ylikirjoitettava
`PerfTracker.getTarget`.

## Kolme jatkokorjausta: heitto, lähizoomin terävyys, tiheys

### Heitto lensi rajattomasti

Leafletin `inertiaMaxSpeed` on oletuksena **ääretön**. Heiton pituus on
`v² / (2 · inertiaDeceleration · easeLinearity)`, näillä arvoilla
`v²/1360`:

```
1000 px/s ->   735 px    (1,7 ruutua)
2000 px/s ->  2941 px    (6,9 ruutua)
3000 px/s ->  6618 px   (15,5 ruutua)
```

Uloimmassa näkymässä yksi ruutu on noin 47 astetta, joten kolmen ruudun
heitto vie kartan toiselle mantereelle. Katto on nyt **900 px/s ulkona ja
1500 px/s lähellä** (596 px / 1654 px heitto) — ruutuina eikä asteina,
koska tunne on ruudun mittainen.

**Pystysuunnassa kartan sai vedettyä kokonaan pois ruudulta.** Mitattuna
`panBy(0, -3000)` vei keskipisteen 89,8 asteeseen ja jätti ruudun yläosaan
tyhjää. `maxBounds` ±85° pysäyttää sen; pituuspiirin raja on
tarkoituksella löysä (±720°), koska `worldCopyJump` kelaa vaakasuunnassa
maailman ympäri eikä sitä saa estää.

### Lähizoomissa 90 % tekstuurista oli ruudun ulkopuolella

Pehmuste oli `Math.max(vLat, vLng)` **molemmille akseleille**. Pystysuoralla
puhelimella vLat on noin kaksi kertaa vLng, joten pituuspiirin pehmuste oli
kaksinkertainen tarpeeseen nähden — ja pehmuste oli kokonaisen näkymän
mittainen kumpaankin suuntaan, jolloin tekstuuri kattoi **9,5-kertaisen
pinta-alan**. Ruudulla näkyi siis noin kymmenesosa texeleistä.

Pehmuste on nyt akseleittain ja 0,6 näkymää. Raja tulee peittotarkistuksesta:
se laukaisee uuden rakennuksen 0,35 näkymän marginaalilla, joten pelivaraa
jää 0,25 näkymää ennen kuin reuna tulee vastaan. Pienempi pehmuste alkaisi
rakentaa uudestaan kesken tavallisen vierityksen.

Samalla lähizoomin texelbudjetti nostettiin, koska se on siellä
mitattuna halvin: datapisteitä on vähän (z9 56 kpl, z12 36 kpl), joten
idw-solmu on nopea.

```
             texel ennen   texel nyt   rakennus (4x)
uloin          2,49 px      2,49 px      238 ms
z5             2,56         2,31          63 ms
z7             5,83         3,39          89 ms
z9             5,88         3,38          41 ms
z12            5,90         3,38          29 ms
```

Lähizoomin texel pieneni **42 %**, ja sumennus sen mukana 12 px → 7 px.

### Tiheys zoomin mukaan — tietoinen poikkeus sääntöön

`nParticlesBase` sanoo että partikkelimäärä on **ruudun pinta-alasta, ei
zoomista**. Sääntö on yhä oikea siinä mitä varten se tehtiin: tiheys ei saa
vaihdella sen mukaan kuinka ison maa-alueen ruutu kattaa.

Mutta lähellä kenttä on lähes tasainen — koko ruudulla on käytännössä yksi
tuulen suunta ja nopeus — ja silloin sama tiheys ei lue virtauksena vaan
sotkuna kartan päällä. Kaukana taas jokainen jälki kertoo eri asiaa.

```
uloin  401    z7 341 (×0,85)    z9 281 (×0,70)    z11+ 221 (×0,55)
```

**Kerroin on luettavuudesta, ei suorituskyvystä.** Sivuvaikutuksena
lähizoomi on halvempi, mutta se ei ole syy — jos sen kirjaa
suorituskykysäädöksi, seuraava lukija optimoi sen pois väärästä syystä.
