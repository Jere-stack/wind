# Eleet — nipistys, zoom, kosketus

Nipistyszoomin suodatus ja alipikselikäsittely, yhden sormen zoom, zoom-inertia,
zoom-alueen rajaus ja kosketuskohteiden osumapinta.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

## Kosketuskohteet ja pseudoelementtien osumapinta

Kaksi kohtaa, joissa 44 px:n kosketusminimi oli näennäisesti kunnossa mutta
ei ollut. Molemmat löytyivät vain napauttamalla, eivät katsomalla.

**Pseudoelementti ei kasvata osumapintaa.** Play-nappi oli 32 px ja lisäala
haettiin `::after { inset: -6px }` -kehällä, ja kommentti väitti että
"Applen kosketusminimi täyttyy". Mitattuna napautus 20 px keskeltä ei
käynnistänyt toistoa — vaikka `elementFromPoint` palautti napin samassa
pisteessä. `elementFromPoint` ei siis kerro mihin napautus menee.

**Chromiumin kosketussäätö siirtää napautuksen lähimpään maalattuun
kohteeseen.** Pelkkä elementin kasvatus 44 px:ään ei riittänyt: tapahtumat
jäljitettynä `pointerdown` ja `touchstart` osuivat oikein nappiin, mutta
synteettinen **`click` meni sisarelle `#tl-scroll`** — napin läpinäkyvä kehä
hävisi vieressä olevalle vierittimelle. Siksi ympyrä täyttää nyt laatikosta
40 px ja läpinäkyvää kehää jää 2 px, jolla ei ole enää mihin siirtyä.
Mitattu jälkeen: napautus osuu 0, 14 ja 19 px keskeltä.

**Sama sääntö verkkotilan sirussa.** Nappi yksin oli 97×22 px, ja sen
kasvatus 44 px:ään olisi tehnyt sirusta noin 60 px korkean palkin. Siksi
kohde on koko siru (252×44) ja nappi on näkyvä vihje, joka on yhä
`<button>` näppäimistölle ja ruudunlukijalle — `pointer-events: none`,
jotta napautus menee sirulle.

Jos lisäät kosketuskohteen, **napauta sitä testissä.** Koon lukeminen
`getBoundingClientRect`ista tai `elementFromPoint`ista ei kerro totuutta.

## Zoom-alue

`maxZoom` on 16 = pohjakartan `maxNativeZoom`. Aiemmin 13, mikä on kaupungin
mittakaava: yksittäistä lahtea tai rantautumispaikkaa ei nähnyt, vaikka
teräviä laattoja on z16 asti. Yli 16 Leaflet venyttäisi laatan.

**Ennuste ei tarkennu zoomatessa** — HARMONIE-hila on noin 2,5 km ja
`ViewportGrid.gridStep` pysyy 0,25 asteessa z10:stä ylös — joten z14–16
näyttää kentän lähes tasaisena. Se on rehellistä: hienompaa tietoa ei ole,
ja siellä katsotaan rantaviivaa ja spottia eikä kentän rakennetta.

Tarkistettu ettei kenttä tyhjene korkealla zoomilla: `buildWindField` lukee
`getAllPoints()`, joka on kumulatiivinen, ja `getViewportPoints` täyttää
`step*2` marginaalilla. Mitattu z16:ssa: 32 laattaa, lämpökartta paikallaan,
partikkelit toimivat, ei virheitä.

## Nipistyszoomin pehmennys

Leafletin `TouchZoom._onTouchMove` laskee skaalan ja keskipisteen **suoraan
sormien sijainneista joka touchmove-tapahtumassa, ilman minkäänlaista
suodatusta**. Sormen vapina menee siis sellaisenaan muunnokseen. Tämä ei ole
Leafletin bugi vaan puuttuva ominaisuus: Apple Maps, Google Maps ja Mapbox
kaikki suodattavat eleen ennen kuin se päätyy kameraan.

**Miksi se näkyy juuri reunoilla.** Skaalavirhe `ds` siirtää pistettä joka on
etäisyydellä `r` ankkurista määrän `r*ds`. Ankkurin kohdalla `r = 0` eikä
mitään näy, mutta 390×844 ruudun nurkassa `r` on noin 460 px. Sama virhe on
keskellä näkymätön ja reunalla iso — juuri siksi ilmiö näyttää
"reunojen värinältä" eikä zoomin epävakaudelta.

**Kolme eri tapausta, ei yksi.** Pito (sormet paikallaan lasilla), hidas
tahallinen liike ja nopea ele vaativat kukin oman mittarinsa, ja korjaus
joka ratkaisee yhden ei ratkaise muita. Tämä meni pieleen kahdesti ennen
kuin vaikein tapaus tuli mitatuksi oikein.

**Vaikein on hidas tahallinen liike**: toinen sormi paikallaan, toista
siirretään niin varovasti kuin pystyy. Kaksi syytä:

- **Hidas sormenliike ei ole tasaista.** Se etenee 2–4 px nykäyksin ja
  pysähdyksin — hidas lihaskontrolli on luonnostaan katkonaista. Juuri
  pysähdyksillä käyttäjä odottaa kartan olevan paikallaan.
- **Ele on epäsymmetrinen.** Sormet saavat eri katkotaajuuden, koska One
  Euro adaptoituu kunkin signaalin omaan nopeuteen. Zoom lasketaan niiden
  **erotuksesta**, joten eri viiveet jättävät eroon keinotekoisen
  komponentin joka elää nopeuden mukana.

### One Euro -suodin

Korjaus on One Euro (Casiez, Roussel & Vogel, CHI 2012):
`cutoff = minCutoff + beta*|nopeus|`. Se on tähän oikea työkalu koska se on
**adaptiivinen** — hitaassa liikkeessä suodattaa voimakkaasti (vapina katoaa),
nopeassa löysää otettaan (ele ei jää jälkeen). Kiinteä alipäästö ei kelpaisi:
se joko jättäisi vapinan tai lisäisi viivettä tarkoitukselliseen eleeseen.

**Suodatetaan sormien sijainnit, ei zoomia.** Silloin Leafletin oma
matematiikka pysyy koskemattomana ja etäisyys sekä keskipiste pysyvät
keskenään johdonmukaisina. Zoomin suodattaminen jälkikäteen siirtäisi
ankkuria, koska keskipiste on laskettu eri zoomille — kartta luisuisi sormien
alta. Toteutus (`nipistysPehmennys()` ennen `initMap`ia) korvaa
`map.mouseEventToContainerPoint`in eleen ajaksi ja palauttaa sen `finally`ssä.

Yksityiskohtia jotka eivät ole ilmeisiä:

- **Sormet tunnistetaan `identifier`illa, ei järjestysnumerolla.** Jos sormi
  nousee ja toinen laskee, indeksi osoittaisi eri sormeen ja suodin hyppäisi.
- **Suotimia ei nollata kesken eleen.** Kolmas sormi laukaisee touchstartin,
  joten nollaus on ehdollinen: `if (!this._zooming)`.
- **Näytteenottotaajuutta ei oleteta.** `alpha` lasketaan mitatusta `dt`:stä,
  joten 120 Hz ProMotion suodattaa saman verran kuin 60 Hz.
- **Panorointia ei suodateta.** Se siirtää koko karttaa yhtä paljon
  kaikkialla, joten `r`-vahvistusta ei ole eikä vapina erotu; suodatus vain
  hidastaisi vasteen.

### Kaksi korjausta: dCutoff ja aste

**1. `dCutoff` 1,0 → 0,3.** Nopeusestimaatti alipäästetään paljon tiukemmin.
Ennen **vapina itse ajoi sitä**: mitattuna PAIKALLAAN olevan sormen
katkotaajuus oli 1,79 Hz vaikka `minCutoff` on 1,0. Suodin avasi itsensä
juuri sillä signaalilla jota sen piti vaimentaa. 1,5 px vapina 7,3 Hz:ssä on
69 px/s huippunopeutta, ja `dCutoff 1,0` päästää siitä läpi noin seitsemäsosan
— kerrottuna betalla se on enemmän kuin koko `minCutoff`.

Tämä on One Euron oma ansa: `beta` viritetään yleensä nopealle eleelle, mutta
`dCutoff` ratkaisee toimiiko suodin lainkaan hitaassa päässä.

**2. Toinen aste → neljäs.** Neljä napaa vaimentaa 80 dB/dekadi eikä 40.
Ryhmäviive on `N/(2π·fc)`, joten korkeampi aste maksaa viiveenä — mutta koska
`beta` avaa katkotaajuuden nopeassa eleessä, hinta lankeaa vain sinne missä
vapina ei ole ongelma. **Identtiset reaalinavat eivät ylitä kohdetta**: ei
ylihyppyä eikä soimista, mikä suorassa manipulaatiossa on tärkeämpää kuin
Butterworthin jyrkempi kulma.

### Mitatut arvot

Nämä on mitattu **oikeasta koodista**, ei mallista: Leafletin `_onTouchMove`
kutsutaan suoraan synteettisillä tapahtumilla joiden `timeStamp` on tasan
60 Hz, ja mitataan miten paljon ruudun nurkassa oleva maantieteellinen piste
liikkuu. Näin dispatch-tahti ei sotke mitään mutta koko ketju — oma suodin ja
Leafletin matematiikka — ajetaan sellaisenaan.

```
                            pito         nykivä 3 px      tasainen 4 px/s
2. aste 0,8/0,30 dC 1,0   0,138 px/r   0,327 px/r 30 %   0,248 px/r 15 %
                          14 vaihtoa    11 vaihtoa/s      12 vaihtoa/s
4. aste 1,0/0,30 dC 0,3   0,008 px/r   0,118 px/r  0 %   0,060 px/r  0 %
                           7 vaihtoa     0 vaihtoa/s       0 vaihtoa/s
```

`px/r` = nurkan liike ruudusta toiseen, kohina keskiarvon ympärillä.
`%` = ruudut jotka menevät väärään suuntaan. `vaihtoa/s` = suunnanvaihtoja
sekunnissa.

**Ratkaiseva mittari on suunnanvaihto, ei poikkeama radalta.** Silmä lukee
epämonotonisen liikkeen tärinäksi vaikka poikkeama olisi murto-osa
pikselistä — nykäysten välisillä tauoilla se oli 9 kertaa sekunnissa, nyt 0.
Pidossa kohina putosi 0,138 → 0,008 px ruutua kohti, eli 94 %.

**Hinta.** Tauon aikainen huippuero kasvoi 0,34 → 0,72 px, mutta se on
tasaista kiinniottoa ilman suunnanvaihtoja. Hidas ele laahaa noin 6 px, nopea
zoomaus 10 ms (5 ms ennen), ja 3 px askeleen jälkeen kartta asettuu 500 ms:ssa
(150 ms ennen) — ei valumista.

### Suodin ei riittänyt — vika oli renderöinnissä

Kolme kierrosta viritettiin syötettä, ja käyttäjä näki värinän joka kerta.
Ratkaiseva mittaus oli vasta se joka luki **renderöidyn DOMin** eikä Leafletin
laskemia arvoja: pohjakartan laatan todellinen `getBoundingClientRect()` joka
ruudussa.

```
hidas nipistys 6 px/s        kohina      suunnanvaihtoa/s
laskettu zoom                0,000 px          0
renderöity laatta x          0,556 px         10
renderöity lämpökartta       0,549 px    55 % askelista kokonaisia pikseleitä
```

**Syöte oli täydellisen sileä ja renderöinti tärisi.** Leaflet pyöristää
sijainnit kokonaisiin pikseleihin joka ruudussa, neljässä paikassa:

```
Map._getNewPixelOrigin        ..._round()
Map.latLngToLayerPoint        project(...)._round()
GridLayer._setZoomTransform   ....round()
Marker.update                 latLngToLayerPoint(...).round()
```

Se on **oikein paikallaan olevalle kartalle** — kokonaispikseli pitää laatat
ja tekstin terävinä. Nipistyksessä se on väärin: skaala muuttuu jatkuvasti,
joten pyöristetty siirtymä napsahtaa pikselin kerrallaan. Hitaassa liikkeessä
napsahdukset ovat harvassa, jolloin kukin näkyy erillisenä hyppynä — juuri
siksi vika tuntui pahimmalta silloin kun sormea liikutti varovaisimmin, ja
juuri siksi paremmasta suodatuksesta ei ollut apua.

Pahempi on että **jokainen kerros pyöristää erikseen**: laatat, lämpökartta
(ImageOverlay) ja merkit napsahtavat eri hetkillä, jolloin ne liikkuvat myös
toistensa suhteen. Se on näkyvämpää kuin absoluuttinen liike.

Eleen ajaksi pyöristys poistetaan kaikilta neljältä (`alaPyorista`). Mitattuna
renderöidystä DOMista:

```
                    ennen                    jälkeen
pito, laatta y      0,646 px  26 vaihtoa/s   0,017 px   4 vaihtoa/s
pito, lämpökartta   0,599 px  15 vaihtoa/s   0,019 px   4 vaihtoa/s
nykivä, laatta x    0,562 px  12 vaihtoa/s   0,097 px   0 vaihtoa/s
nykivä, lämpökartta 0,681 px   6 vaihtoa/s   0,224 px   0 vaihtoa/s
tasainen, laatta x  0,556 px  10 vaihtoa/s   0,073 px   0 vaihtoa/s
```

Pidossa laatan heilunta putosi **97 %** ja kokonaispikseliaskelten osuus
42 %:sta nollaan. Liikkeessä suunnanvaihdot menivät nollaan kaikilla
kerroksilla.

**Lippu on nollattava ennen eleen loppusijoittelua, ei sen jälkeen.**
`_onTouchEnd` kutsuu `_animateZoom`/`_resetView`, joka laskee lopullisen
pikseliorigon. Ensimmäinen versio nollasi lipun `zoomend`-tapahtumassa, eli
liian myöhään: origoksi jäi 298217,97 ja kartta olisi ollut levossa
puolikkaan pikselin sivussa — pysyvästi epäterävä. Nyt nollaus tehdään
`_onTouchEnd`in alussa ja origo on levossa kokonaisluku.

### Paikkaukset on asennettava heti, ei ensimmäisessä eleessä

**Leaflet tallentaa tapahtumakuuntelijan funktioviitteen sillä hetkellä kun
kerros lisätään kartalle** (`map.on('zoom', this._reset, this)`). Jos
prototyypin korvaa myöhemmin, jo rekisteröity kuuntelija osoittaa yhä vanhaan
funktioon.

Ensimmäinen versio asensi pyöristyksen purun laiskasti eleen alkaessa. Kolme
neljästä paikkauksesta toimi silti, koska ne kutsutaan sisäisesti ja haetaan
joka kutsulla (`_getNewPixelOrigin`, `latLngToLayerPoint`,
`_setZoomTransform`). Kaksi kuuntelijaksi rekisteröityä — `ImageOverlay._reset`
ja `Marker.update` — eivät päivittyneet lainkaan, eli lämpökartta ja
**kaikki 31 spottimerkkiä pyöristivät edelleen**.

Mitattuna merkin liike eleen aikana:

```
                       kokonaispikseliaskelia
laiska asennus         x 100 %   y 76–88 %
heti latauksessa       x   7 %   y  1–2 %
```

Sata prosenttia tarkoittaa että jokainen askel oli tasan kokonainen pikseli:
31 terävää merkkiä nykii samaan aikaan kun pohjakartta liukuu sileästi. Se on
näkyvämpää kuin pohjakartan oma värinä, koska merkit ovat pieniä ja
kovareunaisia.

**Jos paikkaat Leafletin prototyyppiä, tarkista onko metodi rekisteröity
kuuntelijaksi** (`getEvents()`). Jos on, paikkauksen on oltava paikallaan
ennen `addTo(map)`:ia.

### Ele ei saa ladata uusia laattoja

`updateWhenZooming: false` pohjakartalle. Oletuksena Leaflet luo uuden
laattatason heti kun pyöristetty zoom vaihtuu — myös kesken eleen. Mitattuna
3 sekunnin hitaassa nipistyksessä (z11 → z12,5):

```
                        DOM lisätty  poistettu  laattoja paneelissa
updateWhenZooming true       102         65      32 → 50 kesken eleen
updateWhenZooming false       84         47      32 koko eleen ajan
```

Kokonainen laattataso ladattiin, dekoodattiin ja häivytettiin sisään sillä
aikaa kun käyttäjä vielä liikutti sormia. Se näkyy välkkymisenä ja terävyyden
hyppyinä, eikä mikään syötteen suodatus poista sitä. Nyt olemassa olevat
laatat vain skaalautuvat ja oikea taso ladataan kun ele päättyy — sama minkä
Apple Maps ja Google Maps tekevät.

### Lämpökartta samaan muunnokseen kuin laatat

`ImageOverlay._reset` kirjoittaa joka ruudussa `left`, `top`, **`width`** ja
**`height`**. Kaksi jälkimmäistä ovat layout-operaatioita, ja kohteena on
ruudun suurin elementti. Laatat sen sijaan liikkuvat pelkällä transformilla,
joka menee suoraan kompositoinnille.

Eleen ajaksi lämpökartta saa **täsmälleen saman kaavan kuin laattataso**:
`origin * skaala - pikseliorigo`, koko jäädytetään eleen alun arvoon ja
`scale()` hoitaa loput. Kaksi seurausta: kerrokset eivät voi ajautua
erilleen, koska niiden sijainti tulee samasta lausekkeesta, eikä eleen aikana
tehdä layoutia.

**`mix-blend-mode: plus-lighter` kestää scale-muunnoksen** — se tarkistettiin,
koska sekoitus on helppo rikkoa kompositointia muuttamalla. Mitattu
värikylläisyys levossa 57,7 → kesken eleen 60,5 → eleen jälkeen 60,4.

### Kolme hylättyä ratkaisua — ja mitä ne yhdessä todistavat

**Ennakointi (lead compensation).** Ajatus on kumota viive nopeustermillä
`y + v/(2π·fc)`, jolloin katkotaajuuden voisi laskea rajusti. Mitattuna se
teki hitaasta liikkeestä **11,88** — huonomman kuin suodattamaton 10,03 —
koska hitaalla nopeudella nopeusestimaatti on lähes pelkkää vapinaa ja
ennakointi syöttää sen takaisin. Nollaviive, kaikki värinä.

**Kuollut alue nopeudessa** (`cutoff = mc + beta*max(0, |v| - v0)`). Vei
pidon värinän lähes nollaan, mutta pieni 3 px askel ei ylitä kynnystä
lainkaan: katkotaajuus jää pohjalle ja kartta valuu **3,2 sekuntia** askeleen
jälkeen. Kynnys joka erottaa vapinan liikkeestä erottaa myös liikkeen
liikkeestä.

**Elesuureiden suodattaminen** (etäisyys `d` ja keskipiste `m` erikseen sen
sijaan että suodatetaan sormet) kokeiltiin, koska se poistaisi sormien
välisen viive-eron. Se ei kannattanut: `d` sisältää molempien sormien
vapinan, joten sen nopeusestimaatti on vielä pahemmin vapinan ajama.
Per-sormi voitti mitattuna.

**Holtin kaksoiseksponentti.** Alipäästö laahaa ramppia rakenteellisesti
`v·τ` verran; Holt mallintaa myös trendin, jolloin vakionopeuksisen rampin
pysyvä viive on nolla. Teoriassa juuri se mitä tarvitaan. Mitattuna kohina
0,55–0,88 px/ruutu (nykyinen 0,038), 15 suunnanvaihtoa sekunnissa ja
**4–6 px ylihyppy** kun liike pysähtyy.

**Nollaviiveinen FIR** — pienimmän neliösumman suora N:n viime näytteen
ikkunaan, arvo ikkunan lopusta. Ei takaisinkytkentää, joten ei soimista, ja
rampilla viive on nolla. Mitattuna kohina 0,16–1,8 px/ruutu, eli sekin
huonompi kuin nykyinen 0,028–0,25.

**Mitä nämä kolme yhdessä todistavat.** Kaikki kolme yrittävät poistaa
ramppiviiveen, ja se onnistuu vain estimoimalla signaalin **derivaatta**.
Näillä nopeuksilla derivaatta on lähes kokonaan vapinaa: sormi etenee
2–8 px/s, mutta 1,3 px vapina 7,3 Hz:ssä on 60 px/s huippunopeutta. Signaali-
kohinasuhde derivaatassa on siis selvästi alle yhden, ja jokainen menetelmä
joka nojaa siihen syöttää kohinan takaisin ulostuloon. **Syötteen puolella
lisää pehmeyttä saa vain lisää viivettä vastaan** — se ei ole viritysasia
vaan tiedon puute. Jos joku palaa tähän: älä yritä neljättä
derivaattapohjaista menetelmää, vaan katso onko renderöinnissä vielä jotain.

### Mittarit jotka eivät toimineet

Tämä oli kolme kertaa väärin ennen kuin oli oikein, ja kaikki kolme virhettä
näyttivät uskottavilta lukuina:

1. **Toisen erotuksen RMS selaimessa** antoi 20 px myös nollavapinalla ja
   *pieneni* kun vapinaa lisättiin. Se mittasi omaa dispatch-tahtiani, ei
   karttaa.
2. **Liukuvan keskiarvon jäännös** antoi 9 px nollavapinalla: liukuva
   keskiarvo on harhainen kaarevalla radalla, ja nurkan rata on voimakkaasti
   kaareva (`2^dz`). Savitzky–Golay (kvadraattinen) korjaa harhan mutta
   selaimen eleputki oli silti liian meluisa.
3. **Poikkeama ideaalista yhtenä lukuna** sekoitti tärinän ja viiveen:
   ensimmäinen viritys näytti että suodatus tekee asiasta 14× pahemman,
   koska rampin aikana viive hallitsi mittaria kokonaan.
4. **Savitzky–Golay-jäännös on sokea hitaalle tapaukselle.** Se poistaa
   kaiken trendiä hitaamman, eli juuri sen matalataajuisen huojunnan jonka
   silmä hitaassa liikkeessä näkee. Mittari antoi hitaalle liikkeelle siistin
   0,69 px:n luvun samaan aikaan kun kartta oikeasti peruutti joka
   neljännessä ruudussa. Hitaan liikkeen mittari on **ruutujen välinen
   siirtymä**: sen hajonta suhteessa keskiarvoon, ja väärään suuntaan
   menevien ruutujen osuus.
5. **Yhden suotimen ajaminen sormien etäisyydelle `d`** antaa eri tuloksen
   kuin toteutus, joka suodattaa kaksi sormea erikseen. Ero ei ole
   akateeminen: adaptiivinen katkotaajuus riippuu kunkin signaalin omasta
   nopeudesta, ja `d` muuttuu kaksi kertaa niin nopeasti kuin kumpikaan
   sormi. Ensimmäisen kierroksen viiveluvut olivat siksi noin puolet liian
   pieniä. Harnessin on syötettävä `±d/2` kahtena signaalina.
6. **Symmetrinen rata piilotti koko ongelman.** Kaksi kierrosta viritettiin
   radalla jossa molemmat sormet liikkuvat yhtä paljon vastakkaisiin
   suuntiin. Silloin sormet saavat saman katkotaajuuden eikä viive-eroa
   synny — eli juuri se mekanismi joka käyttäjän tapauksessa tärisyttää
   karttaa puuttui mallista kokonaan. Radan on oltava epäsymmetrinen:
   **toinen sormi paikallaan.**
7. **Tasainen hidas ramppi ei ole hidas liike.** Ihminen ei pysty
   liikuttamaan sormea tasaisesti 5 px/s — liike on nykäyksiä ja taukoja.
   Tasaisella radalla mitattuna kaikki näytti korjatulta samaan aikaan kun
   nykivällä radalla tauoilla oli 11 suunnanvaihtoa sekunnissa.
8. **Tauon aikainen kokonaissiirtymä sekoittaa asettumisen ja värinän.**
   Raskaampi suodin liikkuu tauon aikana ENEMMÄN, koska se ottaa edellistä
   nykäystä kiinni — mittari näytti siis huonommalta juuri kun asia parani.
   Oikea luku on suunnanvaihtojen määrä sen jälkeen kun asettumiselle on
   annettu 250 ms.
9. **Kaikkein tärkein: `tz._center` / `tz._zoom` EI OLE se mitä käyttäjä
   näkee.** Kolme kierrosta mitattiin Leafletin laskemia arvoja, ja ne
   olivat jo toisen kierroksen jälkeen käytännössä täydellisiä — samaan
   aikaan kun ruudulla laatta heilui puoli pikseliä kymmenen kertaa
   sekunnissa. Kun suodatuksen parantaminen ei enää auta, vika on
   suotimen ja pikselien VÄLISSÄ. Mittaa `getBoundingClientRect()`
   oikeista DOM-elementeistä.
10. **Yhden kerroksen mittaaminen ei riitä.** Laatta ja lämpökartta olivat
    jo täsmällisiä samaan aikaan kun merkit liikkuivat 100-prosenttisesti
    kokonaisin pikselein. Mittaa jokainen kerros joka on kartan päällä:
    laatat, lämpökartta, merkit. Erillinen mittari kullekin.
11. **Kaikki mikä liikkuu ei liiku paikassa.** Uusien laattojen lataus ja
    häivytys kesken eleen ei näy missään sijaintimittarissa, mutta näkyy
    silmälle. Se mitataan `MutationObserver`illa laattapaneelista.
12. **Ruutuaikaa ei kannata mitata headless-selaimessa.** Yritettiin:
    mediaani 33,3 ms 1× jarrulla, eli 30 fps, ja laattaelementti vaihtui
    kesken mittauksen niin että askelhajonnaksi tuli 30 px. Molemmat ovat
    mittalaitteen ominaisuuksia, eivät sovelluksen. Deterministinen
    `_onTouchMove` + kaksi rAF:ää on ainoa luotettava selainmittari tässä.

Toimiva mittari kutsuu **oikeaa koodia**: `L.Map.TouchZoom.prototype._onTouchMove`
suoraan synteettisillä tapahtumilla joiden `timeStamp` on tasan 60 Hz, ja
lukee `tz._center` / `tz._zoom` joka kutsun jälkeen. Selaimen eletapahtumia ei
tarvita, joten dispatch-tahti ei sotke — mutta mitään ei myöskään mallinneta.
Analyyttinen harness on hyvä pyyhkäisyihin (satoja asetuksia sekunneissa);
lopputulos varmistetaan aina oikealla koodilla. Ne täsmäsivät kolmen
desimaalin tarkkuudella, mikä on hyvä merkki molemmista.

Ajettavat tapaukset ovat **pito**, **nykivä hidas** (epäsymmetrinen: toinen
sormi paikallaan, 2–4 px askelia ja 380 ms taukoja) ja **tasainen hidas**.
Nopea ele ja asettumisaika ovat regressiotarkistuksia — jälkimmäinen sen
varalta ettei kartta ala valua itsestään.

Rataan kuuluu myös **kvantisointi**: kosketuspisteet raportoidaan
laitepikselihilalla, ja hitaassa liikkeessä se on portaikko eikä
satunnaiskohinaa. Sen osuus suodattamattomasta kohinasta on 25 % nopeudella
10 px/s ja 48 % nopeudella 25 px/s — ei sivuseikka.

Kolmas ansa: **beta on eri mittakaavassa riippuen siitä mitä suodatetaan.**
Zoomin nopeus on noin 0,5/s, sormen etäisyyden kymmeniä px/s. Ensimmäinen
pyyhkäisy tehtiin zoomiavaruudessa ja `beta 0,15` oli siellä käytännössä
nolla. Viritys on tehtävä siinä avaruudessa jossa toteutus toimii.

Selaimessa varmistettiin vain **oikeellisuus**, ei numeroita. Oikeilla
kosketustapahtumilla, `zoomSnap: 0`:n jälkeen:

```
levitys 70→170 px      10,000 → 11,217
kavennus 170→70 px     11,217 →  9,995
hidas 8 px/s            9,995 → 10,277
nopea nykäisy          10,277 → 12,314
kolmas sormi kesken    12,314 → 12,822
```

Lisäksi joka eleen jälkeen: `_zooming` false, alipikselitila purettu,
`nipistys`-luokka poistettu, pikseliorigo kokonaisluku, ei JS-virheitä.

## Eleen loppu ja tuntuma — kolme asiaa Apple Mapsista

Kun eleen aikainen sileys oli mitattu kuntoon, jäljelle jäi kolme asiaa
jotka erottavat selainkartan natiivista. Kaksi niistä ei näy missään
sileysmittarissa, koska ne tapahtuvat sillä hetkellä kun sormet irtoavat.

### 1. zoomSnap 0 — ele päättyy siihen mihin sormet sen jättivät

`zoomSnap` oli 0,5, eli Leaflet animoi eleen jälkeen lähimpään puolikkaaseen
tasoon. Mitattuna kahdeksalla eleellä:

```
sormiväli   zoom irrotettaessa   napsahti   skaalahyppy
   116 px          11,181          11,00       13,4 %
   180 px          11,817          12,00       13,5 %
   240 px          12,239          12,00       18,0 %
keskimäärin 0,133 zoomtasoa, suurin 0,239
```

**Kartta muutti kokoaan jopa 18 % sillä hetkellä kun sormet irtosivat**, joka
ikisessä eleessä. Se on satakertaisesti suurempi epäjatkuvuus kuin ne
alipikselin jäänteet joita eleen aikana oli hiottu. Arvolla 0 hyppy on 0,000
kaikissa kahdeksassa tapauksessa.

**Terävyys ei kärsi, vaikka niin voisi luulla.** Leaflet lataa laattatason
`Math.round(zoom)`, joten zoom 11,5 skaalaa jo nyt z12-laattoja kertoimella
0,707. Skaalan vaihteluväli on `[1/√2, √2]` kummallakin asetuksella —
napsautus ei osta terävyyttä, se vain siirtää kartan pois siitä mihin se
jätettiin.

`zoomDelta` pysyy 0,5:ssä, joten napit ja kaksoisnapautus liikkuvat yhä
siisteinä askelina. Tarkistettu ettei murtolukuzoom riko välimuisteja: kaikki
zoomista riippuva logiikka haarukoi välejä (`ViewportGrid.gridStep`,
ikonikoot, `_windIconSig`).

### 2. Zoom-inertia

Leafletissa on panorointi-inertia mutta zoomille ei mitään — zoom pysähtyy
kuin seinään. Toteutus **ei ole oma animaatiosilmukka** vaan maalin jatko:
eleen päättyessä zoomiin lisätään `v·TAU` ja keskipiste lasketaan uudelleen
samalle ankkurille, minkä jälkeen Leafletin oma 250 ms:n siirtymä
(`cubic-bezier(0,0,0.25,1)`, eli ease-out) hoitaa liu'un. Kerrosten
synkronointi, laattojen lataus ja `zoomend` tulevat valmiina eikä mikään
kilpaile Leafletin tilakoneen kanssa.

Mitattu (kynnys 0,4 /s, TAU 0,12 s, katto 0,5):

```
ele                  zoom irrotettaessa -> lopullinen   lisä    ankkurin luisto
nykäisy 350 ms          13,076 -> 13,475            +0,399        0,45 px
tavallinen 900 ms       12,104 -> 12,164            +0,060        0,33 px
varovainen 8 px/s       11,285 -> 11,285             0,000        1,07 px
pito                    10,997 -> 10,997             0,000        0,36 px
nykäisy ulos             9,156 ->  8,656            −0,500        0,45 px
```

**Kynnys on välttämätön, ei viimeistelyä.** Hitaassa liikkeessä
nopeusestimaatti on lähes pelkkää vapinaa — tässä projektissa se on mitattu
kolmesti (Holt, FIR-sovite ja lead compensation kaatuivat kaikki siihen).
Ilman kynnystä inertia lisäisi satunnaista zoomia juuri siihen eleeseen jota
on eniten hiottu. Mitatut nopeudet erottuvat puhtaasti: nykäisy 3,72 /s,
tavallinen 0,85 /s, varovainen 0,093 /s, pito 0,004 /s. Kynnys vähennetään
lisästä, joten sen ylitys ei tuota hyppyä.

Katto on 0,5 eikä 0,7, koska ulospäin nykäisyssä `|v|` on suurempi kuin
sisäänpäin: sormiväli kutistuu logaritmisella asteikolla nopeammin kuin se
kasvaa. Katolla 0,7 pari oli +0,40 sisään ja −0,70 ulos, mikä tuntuu
epäsymmetriseltä.

### 3. Rasterointi kiinni eleen ajaksi

`.nipistys .leaflet-tile-container, .nipistys .heatmap-overlay
{ will-change: transform }`. Kun skaala muuttuu jatkuvasti, selain voi
rasteroida sisällön uudelleen kesken eleen — se näkyy **terävyyden hyppyinä
eikä siirtymänä**, joten mikään sijaintimittari ei sitä näe. `will-change`
kertoo että muunnos jatkuu, jolloin selain rasteroi kerran ja skaalaa GPU:lla.

Luokka on voimassa **vain eleen ajan**. Pysyvä `will-change` pitäisi kerrokset
omassa muistissaan jatkuvasti ja estäisi alipikselitarkan tekstin renderöinnin
levossa. Tarkistettu mittauksella: `will-change` on levossa `auto`, eleen
aikana `transform`.

`plus-lighter` kestää sen. Kompositointitason muutos on tyypillinen tapa
rikkoa sekoitustila, joten se mitattiin: värikylläisyys 57,7 levossa → 60,5
kesken eleen → 60,4 jälkeen.

### Zoom-eleitä on kaksi

`_installDoubleTapZoom` (tuplanapauta ja vedä pystysuunnassa) kutsuu
`map._move`a **suoraan**, ohi Leafletin `TouchZoom`in. Se jäi siksi kokonaan
ilman alipikselikäsittelyä. Eleen tila on nyt yhdessä paikassa —
`nipistysAlkaa` / `nipistysPaattyy` — ja molemmat polut kutsuvat sitä.

Samalla lisättiin puuttuva `touchcancel`-käsittelijä: ilman sitä keskeytynyt
veto jätti `dtz.active` päälle, ja nyt se olisi jättänyt myös alipikselitilan
ja `will-changen` pysyvästi voimaan. Leafletin oma `TouchZoom` kuuntelee
`'touchend touchcancel'` juuri tästä syystä.

> Tässä luvussa korjattiin vain yhden sormen zoomin **alipikselikäsittely**.
> Itse ele oli edelleen rikki neljällä muulla tavalla — ks.
> *Yhden sormen zoom oli rikki — neljä eri vikaa*.

## Kaksi kokeilua jotka eivät jääneet — älä tee uudestaan

Molemmat rakennettiin, mitattiin ja poistettiin. Luvut kannattaa lukea, koska
ne houkuttelisivat muuten tekemään saman toistamiseen.

**Yksi muunnos koko kartalle** (MapKitin tapa: `tilePane` muunnetaan kerran
eleen ajaksi, kerrokset jäädytetään). Kattohyöty mitattiin ennen toteutusta
ajastamalla se työ jonka se poistaisi: `GridLayer._setZoomTransform` 0,015 +
`ImageOverlay._reset` 0,000 + `Marker.update` 0,016 = **0,031 ms/ruutu**, eli
0,2 % budjetista. Sijainneissa ei ole voitettavaa, koska täydellisellä
syötteellä renderöinti on jo tasan 0,000 px kaikilla kerroksilla, ja
rasteroinnin hoitaa `will-change` murto-osalla vaivasta. Blend-riski
mitattiin silti (se oli aiempi hylkäysperuste): `tilePane` muunnettuna
värikylläisyys 58,77 → 59,49 → 58,78, eli riski ei ollut todellinen. Ei
toteutettu.

**Hiukkaset jäähän eleen ajaksi.** Tämä toteutettiin ja **peruttiin
käyttökokemuksen perusteella**, vaikka mittarit olivat erinomaiset. Eleen
aikainen `renderLoop` putosi 4× CPU-jarrulla 6,30 → 0,10 ms mediaanina ja
pahin ruutu 18,30 → 2,10 ms, koska koko kustannus on `nauha`-funktion
Path2D-nauhojen rakentaminen uudelleen joka ruudussa (9,18 ms/ruutu, 92 %
silmukasta, 210 kutsua/ruutu). Jäädytettynä polut kelpaavat sellaisenaan ja
piirto on yksi matriisi ja kaksi `fill`-kutsua. Rekisteröinti pysyi
täsmälleen ennallaan (0,545 px kartan suhteen molemmilla versioilla).

Silti se oli laitteella huonompi. **Se on tämän luvun tärkein tieto:**
ruutuaikamittari ei kerro kaikkea. Tuulianimaation pysähtyminen eleen ajaksi
maksaa enemmän kuin 6 ms ruutuaikaa voittaa — kartta näyttää jäätyvän juuri
silloin kun sitä katsotaan tarkimmin. Panorointi ohittaa partikkelityön, ja se
tuntuu eri asialta, koska panoroinnissa kuva liikkuu tasaisesti eikä sisältö
muutu.

Jos ruutuaika joskus oikeasti rajoittaa nipistystä, oikea kohde on `nauha`
itse (9,18 ms/ruutu 4× jarrulla) — ei animaation pysäyttäminen.

**Toteutuksessa oli myös vika joka on hyvä muistaa jos joku palaa tähän:**
sulatus ei saa tehdä omaa `_siirra`a jos loppuanimaatio on jo alkanut.
`_onTouchEnd` käynnistää `_animateZoom`in, joka laukaisee `zoomanim`in →
`Ruudusto.zoomAnim` on jo tehnyt siirron ja kello ohjaa matriisia. Oma siirto
tekee sen toiseen kertaan animaation maaliin, jolloin hiukkaset hyppäävät
maalille kartan ollessa vielä matkalla — mitattuna mediaanivirhe 349 px.

Ja mittari joka ei kelpaa: yksittäisen hiukkasen seuranta eleen yli. Se antoi
277–349 px myös oikealla koodilla, koska sulatuksen jälkeen simulaatio jatkuu
ja osa hiukkasista respawnaa satunnaiseen paikkaan. Kelvollinen mittari
kokoaa `siirraPartikkelit`-kutsut yhdeksi affiiniksi muunnokseksi ja vertaa
kartan täsmälliseen muunnokseen.

## Yhden sormen zoom oli rikki — neljä eri vikaa

Tuplanapauta ja vedä pystysuunnassa (`_installDoubleTapZoom`) nytkähti niin
pahasti että ele oli käytännössä käyttökelvoton. Vikoja oli neljä, ja vain
yksi niistä oli se joka näkyi.

**Mittari.** Se maantieteellinen piste joka oli sormen alla tuplanapautuksen
hetkellä. Jos ankkuri on oikein, sen container-piste ei liiku eleen aikana
lainkaan. Jokainen pikseli jonka se liikkuu on kartan hyppy. Toinen luku on
suurin yhden ruudun siirtymä.

```
                       ankkurin liike     suurin ruutuhyppy
ennen (7 elettä)       0–245 px           0–211 px
jälkeen                0.0 px             0.0 px
```

### 1. Leafletin oma veto panoroi samaan aikaan

Tämä kaatoi eleen kokonaan ja se on tärkein havainto. Leafletin `Draggable`
kuuntelee `touchmove`a **dokumentista** (se lisää kuuntelijan `_onDown`issa),
ja tämä moduuli kuuntelee karttasäiliöstä. `preventDefault` ei estä toista
kuuntelijaa mitenkään — se ei ole `stopPropagation` — eikä
`stopImmediatePropagation` auttaisi, koska se pysäyttää vain **saman
elementin** myöhemmät kuuntelijat.

Mitattuna jokainen sormenliike tuotti kaksi kartan siirtoa peräkkäin:

```
move  →  map:drag   (Leaflet panoroi sormen mukana)
      →  map:zoom   (tämä moduuli asettaa keskipisteen absoluuttisesti)
```

Ne laskevat keskipisteen eri lähtökohdasta, joten kartta nytkähti joka
ruudussa. `map.dragging.disable()` eleen ajaksi on ainoa oikea korjaus;
Leaflet tekee saman `BoxZoom`issa. Palautus `enable()`llä on tehtävä
**jokaisella** poistumistiellä, myös `touchcancel`issa ja silloin kun toinen
sormi vie eleen nipistykselle — muuten karttaa ei voi enää panoroida
lainkaan ennen sivun uudelleenlatausta.

### 2. Ankkuri oli väärässä paikassa

Vanha versio laski siirtymän vain x-akselilla:

```js
var delta = L.point(dtz.startPt.x - dtz.centerPt.x, 0);   /* y aina 0 */
```

Napautettu piste päätyi siis kohtaan **(napautus.x, ruudun keskiY)**.
Ensimmäinen `_move` siirsi karttaa pystysuunnassa sen verran kuin napautus
oli keskikohdasta — ruudun yläosasta napautettaessa yli 200 px, ennen kuin
zoomia oli tapahtunut lainkaan. Oikea siirtymä on `startPt - centerPt`
molemmilla akseleilla. Johto:

```
containerPoint(L) = project(L,z) - pixelOrigin
pixelOrigin       = project(center,z) - size/2
center = unproject(project(L,z) - (startPt - centerPt))
  ⇒ containerPoint(L) = startPt
```

### 3. `zoomstart` ei syttynyt

`map._move()` lähettää vain `move`n ja `zoom`in. Ilman `_moveStart(true,
false)` -kutsua `zoomstart` jäi kokonaan lähettämättä, jolloin
`State.liikkeessa` oli epätosi koko eleen ajan — se ohjaa `IdwPainot`-muistia
ja suorituskyvyn vaihemittaria. Leafletin oma `TouchZoom` kutsuu
`_moveStart`ia täsmälleen samasta syystä ensimmäisellä liikkeellä.

### 4. Vapina näkyi nurkassa

Yhden sormen veto tarvitsee saman One Euro -suotimen kuin nipistys, vaikka
siinä ei olekaan nipistyksen skaalavipua. Mittari on ruudun nurkan liike —
zoomvirhe siirtää ankkurista etäisyydellä `r` olevaa pistettä määrän
`r*ln2*dz`, joten nurkka on herkin kohta. Suunnanvaihdot hitaassa vedossa
(200 px / 2 s):

```
sormen vapina    ennen        jälkeen
±0 px             0            0
±1,5 px          14            0
±3 px            40            2
```

Keskimääräinen nykäys putosi samalla 5.91 → 2.25 px (±1,5 px vapinalla).
Hinta on 6.2 px nurkassa sillä hetkellä kun sormi pysähtyy, ja se kuroutuu
0.2 px:ään 300 ms:ssä. **Ankkuri ei kärsi lainkaan**: suodin vaikuttaa vain
zoomin nopeuteen, ei siihen mihin ankkuri kiinnittyy.

Suodin nostettiin nipistyksen IIFE:stä ulos (`OneEuro`, `Alipaasto` ja
vakiot ovat nyt moduulitasolla), koska kaksi kopiota olisi tarkoittanut
kahta viritystä jotka erkanevat toisistaan. Suodatettava suure on sormen y
ruudulla — samat yksiköt ja sama dynamiikka kuin nipistyksessä.

### Sivulöydökset

- **`setZoomAround` on rajattava ennen kutsua, ei sen sisällä.** Se laskee
  uuden keskipisteen *pyydetyn* zoomin skaalalla ja vasta sitten `setView`
  rajaa zoomin. Maksimizoomissa se antoi kertoimen 2 mukaisen
  keskipistesiirtymän mutta zoomia ei tullut: kartta panoroi **61 px** ilman
  että mitään zoomattiin. Korjaus on `map._limitZoom(startZoom + 1)` ennen
  kutsua ja koko kutsun ohittaminen jos tulos on sama.
- **Napautus ja veto on erotettava kynnyksellä, ei jälkikäteen.** Vanha
  versio zoomasi jo ensimmäisestä liikkeestä mutta päätti vasta
  `touchend`issä oliko kyse napautuksesta (pystymatka < 10 px) — eli lyhyt
  veto ensin zoomasi vähän ja sitten hyppäsi kokonaisen tason. Nyt 8 px:n
  kynnys ratkaisee molemmat. **Kynnysvertailu tehdään raa'alla sijainnilla
  ja zoom suodatetulla**: toisin päin suotimen alkuvaimennus siirtäisi
  kynnyksen ylitystä ajassa eteenpäin ja ele tuntuisi tahmealta lähtiessään.
- **`State._dragZooming` oli kuollut.** Sitä luettiin `moveend`in ja
  `zoomend`in alussa paluuehtona mutta ei asetettu todeksi missään. Kaksi
  vartijaa jotka lupasivat ohittaa lämpökartan ja spottien uudelleenpiirron
  tuplanapautuszoomin ajaksi — mutta juuri se piirto on eleen lopussa
  tehtävä. Poistettu; käytös ei muuttunut, koska lippu oli aina epätosi.
- **Toisen sormen laskeutuessa EI saa kutsua `nipistysPaattyy`ta.**
  `TouchZoom`in oma `_onTouchStart` on rekisteröity kartan luonnissa eli
  ennen tätä moduulia, ja se on jo ehtinyt kutsua `nipistysAlkaa`. Lopetus
  nollaisi juuri sytytetyn lipun ja veisi alipikselitarkkuuden koko
  nipistykseltä. Siksi purku on kahtena funktiona: `siivoa(lopetaNipistys)`
  ja sen päällä `paataEle`.
- **Kesken oleva zoom-animaatio viedään loppuun eikä eleestä luovuta.**
  Leafletin `TouchZoom` kieltäytyy kun `_animatingZoom` on päällä, mutta
  täällä se tarkoittaisi että nopea "zoomaa sisään, zoomaa lisää" -sarja
  tiputtaa joka toisen eleen 250 ms:n ikkunassa. `map._onZoomTransitionEnd()`
  on suojattu omalla lipullaan, joten kutsu on turvallinen.
- **Vartija kadonneen `touchend`in varalta.** Yhden sormen `touchstart`
  kesken oman eleen tarkoittaa että edellinen ele ei saanut `touchend`iä —
  käytännössä siksi että kohde-elementti ehti poistua DOMista (`renderSpots`
  luo spottimerkit uusiksi, ja tuplanapautus voi osua juuri merkkiin). Ilman
  vartijaa `dragging` jäisi pysyvästi pois päältä. Mitattuna Chromium ohjaa
  tapahtuman irronneen solmun sijaan lähimpään kiinni olevaan esi-isään,
  joten tätä ei nykyselaimessa laukea — vartija on siltä varalta ettei niin
  ole.

### Testaamisen sudenkuoppa

**CDP:n `Input.dispatchTouchEvent` ei kelpaa peräkkäisiin eleisiin.**
Ensimmäinen mittausajo näytti että ele toimii vain ruudun alaosassa ja
panoroi muualla. Vika oli mittarissa: eleiden välille jäi tilaa ja
**toinen `touchstart` katosi kokonaan**, jolloin sarjan seuraavat eleet
mittasivat Leafletin tavallista panorointia. Sama ele yksinään ajettuna
toimi joka kerta.

Ratkaisu on luoda `TouchEvent`it sivulla itse (`new Touch(...)` +
`new TouchEvent(...)` + `dispatchEvent` karttasäiliöön). Ne kuplivat
dokumenttiin asti, joten Leafletin oma vetokäsittelijä näkee ne samalla
tavalla kuin oikeat — juuri sitä yhteispeliä tässä testataan. Ainoa asia
joka ei ole uskollinen on selaimen natiivi vieritys, eikä sillä ole tässä
merkitystä.

## Uloin näkymä rajattiin — ja se muutti kaiken muun

Koko pallon näyttäminen ei ole tälle sovellukselle hyödyllinen tila.
Edellinen luku päätyi siihen että z2:n tarkkuutta rajoittaa Mercator
itse: napojen kohdalla yksi tekstuuririvi kattaa kymmeniä asteita, eikä
sille voi tehdä mitään. Johtopäätös ei ollut "hyväksytään se" vaan
**"ei näytetä sitä näkymää"** — sama minkä Windy tekee.

Uloimmillaan näkyy Suomen pohjoisin piste (Nuorgam, 70,1°N) ja
päiväntasaajan eteläpuoli.

### Raja on leveysastevälissä, ei zoom-luvussa

Sama zoom näyttää eri määrän eri kokoisilla ruuduilla, joten kiinteä
`minZoom` olisi väärin joka toisella laitteella. Näkymän on katettava
tietty osuus maailman korkeudesta: maailman korkeus zoomilla z on
256·2^z pikseliä, ja vaadittu Mercator-väli on 28,5 % siitä.

```
                minZoom   näkyy pituutta
iPhone 15 Pro     3,54         47°
iPhone Pro Max    3,67         47°
iPhone SE         3,19         58°
iPad              4,01         71°
vaaka 932×430     2,86        180°
```

Asiat jotka eivät ole ilmeisiä:

- **Toinen ehto rajaa pituuspiirin puoleen palloon.** Vaaka-asennossa
  korkeus puolittuu, jolloin sama leveysastesääntö vaatisi niin paljon
  ulos zoomausta että vaakasuunnassa näkyisi koko maailma. Kumpi tahansa
  ehdoista sitoo, tiukempi voittaa — vaaka-asennossa leveysasteväli jää
  81 %:iin vaaditusta, ja se on tietoinen valinta: molempia ei voi saada
  näyttämättä koko palloa.
- **Uudelleenlaskenta `resize`-tapahtumassa.** Kääntäminen vaakatasoon
  puolittaa korkeuden, eikä `setMinZoom` itse siirrä karttaa jos ollaan
  jo rajan alapuolella.
- **Raja pitää kaikilla reiteillä**: `setZoom`, `setView`, `zoomOut` ja
  nipistys päätyvät kaikki samaan lukuun (testattu).

### Sitten data kannatti tihentää

Kun koko palloa ei enää näytetä, leveä näkymä kattaa niin pienen alueen
että tiheämpi hila alkaa kannattaa. Mitattuna tunnettua kenttää vasten
(RMS m/s, 4× kuristus):

```
   hila      uloin (z3,67)      z5
   2,5°    0.27 / 158 ms   0.32 /  21 ms    <- vanha
   1,25°   0.11 /  39 ms   0.10 /  50 ms    <- z<=4
   1,0°    0.08 /  56 ms   0.07 /  35 ms    <- z5-7
   0,5°    0.05 / 127 ms   0.03 /  42 ms
```

- **1,25° ja 1,0° osuvat SAMAAN laattatasoon (l2, 1°)**, joten ne
  hakevat täsmälleen samat laatat — ero on pelkkää interpolointia eikä
  yhtään lisätavua verkosta. 0,5° vaatisi l1:n, joka kattaa vain
  Pohjois-Euroopan.
- **Pistekatto oli nostettava 1600 → 3400**, muuten katto kasvattaisi
  hilavälin takaisin 2,5 asteeseen juuri siellä missä tihennys tehtiin.
- **`maxDim` uloimmalla kaistalla 200 → 260** (RMS 0.11 → 0.09).
  z5–6 pysyy 200:ssa: siellä sama pyyhkäisy antoi 0.07 kaikilla arvoilla
  200–340, eli rajoite on datahila eikä tekstuuri.
- **Sumennus ei ollut ongelma.** Se mitoitetaan kahteen texeliin, ja
  tiheämmällä tekstuurilla se on uloimmassa näkymässä 3 px eli
  alarajallaan.

### Mikä jää saavuttamatta

**Laattojen oma tarkkuus on katto.** Globaalilla tasolla l2 on 1°, eli
ECMWF:n 0,25° hilasta on heitetty pois 16 pistettä kuudestatoista.
Windy renderöi natiivin 0,25° hilan koko maailmalle, mutta se vaatisi
2592 laattaa ja 290 MB — ei tällä hostingilla. Uloin näkymä on siis
tarkempi kuin ennen mutta ei Windyn veroinen, ja syy on tallennustila
eikä koodi.

### Partikkelit

Tiheys 267 → 401 puhelimen ruudulla (jakaja 1500 → 1000) ja jälki
ohennettiin 2,15–4,45 px → 1,30–2,75 px. Tämä on **toinen tietoinen
poikkeama** mitatusta luettavuusoptimista (ks. `particleLineWidth`):
mittari maksimoi luettavuuden yhtä partikkelia kohti, mutta tiheässä
kentässä paksu jälki peittää lämpökartan alleen.

`PerfTracker`in leikkaus tehtiin **suhteelliseksi ruutunopeuteen**.
Kiinteä 0,7 tarvitsi viisi kierrosta eli noin 15 sekuntia ennen kuin
määrä asettui hitaalla laitteella, ja koko sen ajan kuva nyki. Tavoitetta
nostettiin, joten matka alas on pidempi ja askeleen on mukauduttava:
8 fps antaa kertoimen 0,35.

**Ruutunopeutta EI voitu mitata tässä ympäristössä.** Kontti pysyi
8–18 ruudussa sekunnissa riippumatta partikkelimäärästä (0 ja 700
antoivat saman luvun) ja riippumatta CPU-kuristuksesta — mikä kertoo
että pullonkaula on kontin kompositorissa eikä sovelluksessa. Tiheyden
nosto nojaa siis `PerfTracker`iin eikä mittaukseen, ja se on syytä
tarkistaa oikealla laitteella.

**Sudenkuoppa:** `resetParticles(kova)` kutsuu `PerfTracker.reset()`in,
joka palauttaa tavoitteen `nParticlesBase()`:iin. Partikkelimäärää ei
siis voi pyyhkäistä asettamalla `_targetParticles` ja kutsumalla
`resetParticles` — jälkimmäinen kumoaa edellisen.

## Lämpökartan jäädytys eleen aikana — kaksi vikaa samassa paikkauksessa

Nipistyksen ajaksi lämpökartan elementti saa kiinteän koon ja liikkuu
pelkällä `transform`illa, täsmälleen kuten laattataso (ks. edellinen luku:
`ImageOverlay._reset` -paikkaus). Optimointi on oikea — se poistaa layoutin
ruudun suurimmalta elementiltä joka ruudussa — mutta se teki kaksi
oletusta jotka eivät pidä paikkaansa.

Molemmat oireet olivat käyttäjän mukaan olleet pitkään: **väri katoaa ja
kartta on musta**.

### 1. Ankkuri napattiin kerran, vaikka rajat vaihtuvat kesken eleen

`_nipZ0` ja `_nipP0` otettiin talteen eleen alussa, ja koko jäi eleen
alun arvoon. Se riittää niin kauan kuin kuva pysyy samana — mutta
lämpökartta rakennetaan uudelleen KESKEN eleen (`_heatmapCatchUp`), ja
silloin `setBounds` antaa uudet, laajemmat rajat. Vanhalla ankkurilla ja
vanhalla elementtikoolla uusi laaja tekstuuri piirtyi vanhan pienen
alueen kokoisena.

Mitattuna, nipistys ulos z8 → z5 sormet näytöllä, 4× kuristus:

```
                          maantieteellinen kate    peitto ruudusta
_heatmapCovers()          tosi JOKA RUUDUSSA       —
lämpökartan elementti     —                        8,4 %
```

Tekstuuri siis kattoi näkymän koko ajan; se vain piirtyi väärän kokoisena.
Ruudulla se näkyi **kapeana suorakaiteena keskellä ja paljaana tummana
pohjakarttana ympärillä** — juuri se mistä valitettiin.

Korjaus: rajojen vaihtuessa tehdään täysi `origReset` kerran ja ankkuri
napataan uudelleen. Se on layout, mutta vain **rakennusta kohti** eikä
joka ruudussa, joten optimoinnin alkuperäinen tarkoitus säilyy.
`setBounds` luo aina uuden `LatLngBounds`-olion, joten viitevertailu
(`_nipB0 !== this._bounds`) riittää tunnistamaan muutoksen.

### 2. Jäädytystä ei purettu ennen loppuanimaatiota

Sormen noustessa kartta ei pysähdy vaan liukuu loppuasentoonsa
zoom-inertialla — ja se toteutettiin tarkoituksella Leafletin omana 250 ms
siirtymänä (ks. "Zoom-inertia" yllä), jolloin `_animateZoom` hoitaa
kerrosten synkronoinnin.

`_animateZoom` kuitenkin **olettaa että elementin koko vastaa sen nykyisiä
rajoja**. Jäädytetty koko ei vastaa. Lippu `_nipistysKesken` nollattiin
`nipistysPaattyy`ssä mutta elementin geometriaa ei palautettu, joten
animaatio lähti väärästä lähtökoosta ja heitti kerroksen hetkeksi ruudun
ulkopuolelle.

Mitattuna nopeassa sisäänzoomauksessa (viive 300 ms, 4× kuristus):

```
ruutu   peitto   _animatingZoom   _nipistysKesken
 [10]     0 %          1                 0
 [11]     0 %          1                 0
sitten   100 %         0                 0   <- _reset korjasi: w 3284px -> 865px
```

Yksi–kaksi ruutua joissa lämpökartta oli **kokonaan poissa**. Se on se
musta välähdys.

Korjaus: jäädytys puretaan `nipistysPaattyy`ssä — siis siinä hetkessä kun
kartan tila on vielä eleen loppuasento eli itsensä kanssa yhtäpitävä —
eikä vasta seuraavassa `_reset`issä. Kerrokset haetaan `eachLayer`illa
eikä nimetyn viitteen kautta, jotta sääntö pätee jokaiseen jäädytettyyn
kerrokseen.

### Mitattu lopputulos

Lämpökartan peitto ruudusta, laattojen verkkoviive 300 ms, 4× kuristus.
"huonoja" = ruutuja joissa peitto oli alle 99 %.

| ele | ennen | jälkeen |
|---|---|---|
| ulos + panorointi, sormet näytöllä | 37/71, min 5,8 % | **2/73, min 30 %** |
| ulos nopea, sormet näytöllä | 30/56, min 3,9 % | **3/59, min 14,8 %** |
| sisään nopea | — | **0/25, min 100 %** |
| sisään + voimakas panorointi | 1/48, min **0 %** | **0/40, min 100 %** |
| sisään + panorointi | 0/27, min 100 % | 0/42, min 100 % |

Texelin koko LEVOSSA on molemmissa sama (2,1 / 4,0 / 3,1 px näkymästä
riippuen), eli lepokuvan tarkkuus ei muuttunut lainkaan.

**Mikä jäi jäljelle.** Ulos zoomatessa jää 2–3 ruutua siinä hetkessä kun
sormet nousevat. Syy on zoom-inertia: kartta liukuu vielä enintään 0,5
tasoa ulos, ja sen animaation ajaksi `map.on('zoom')` palaa heti
(`_animatingZoom`), joten kiinniottoa ei ajeta. Tekstuuri kattaa
useimmiten yli, mutta ei aina.

Sitä EI korjattu rakentamalla kesken animaation: `setBounds` vaihtaisi
elementin koon ilman vastaavaa `_animateZoom`-kutsua, mikä nykäisisi
kerrosta — eli vaihtaisi lyhyen reunavälähdyksen näkyvään hyppyyn. Jos
tähän palataan, oikea suunta on rakentaa tekstuuri VALMIIKSI inertian
maalille jo eleen aikana, ei animaation aikana.

### Miksi tätä ei huomattu mittareissa aiemmin

`_heatmapCovers()` vertaa tekstuurin MAANTIETEELLISIÄ rajoja näkymään, ja
se palautti toden koko ajan. Vika oli yksinomaan siinä mihin elementti
piirtyi. **Jos mittaat tätä aluetta, mittaa elementin `getBoundingClientRect`
suhteessa karttasäiliöön** — älä `_heatmapCovers`ia, joka on tässä sokea.

## Uloin raja: vastusta, ei mustaa

`minZoom` rajaa `setZoom`in, rullan ja napit — mutta **ei nipistystä**.
Leafletin `bounceAtZoomLimits` on oletuksena tosi, jolloin ele saa mennä
rajan ali ja Leaflet palauttaa vasta sormen noustessa. Nimestään
huolimatta se ei ole pieni jousto vaan käytännössä rajaton.

Mitattuna iPhone 15 Prolla, minZoom 3,544, nipistys ulos rajalla:

```
                        ennen            jälkeen
zoom syvimmillään       0,088            3,268
rajan ali               3,455 tasoa      0,276 tasoa
maailman korkeus        272 px           2466 px      (ruutu 852 px)
paljasta taustaa        72–92 %          0,0 %
ruutuja yli 1 % paljas  28               0
```

Kartta kutistui postimerkiksi mustalle pohjalle — ja **jäi siihen niin
kauaksi aikaa kuin sormet olivat näytöllä**, koska palautus tulee vasta
`touchend`issä. Ruudulla näkyi Afrikka ja Etelä-Amerikka mustan palkin
alla; sovellus on Suomen rannikon sääkartta.

### Miksi ei pelkkä kova raja

`bounceAtZoomLimits: false` poistaisi mustan yhdellä rivillä, mutta se
tuntuisi kuolleelta: sormet liikkuvat eikä mitään tapahdu. Sen sijaan
tässä on sama minkä iOS tekee vieritykselle — **jousto jonka pohja on
läpinäkymätön**:

```
ulos(y) = jousto · (1 − 1 / (1 + y/jousto))
```

Derivaatta on 1 rajalla, eli siirtymä rajan yli on jatkuva eikä nykäise,
ja arvo lähestyy `jousto`a, joten ele ei pääse sitä kauemmas. `JOUSTO`
on 0,30 zoomtasoa eli 19 % skaalassa: selvästi tunnettava, mutta kaukana
siitä missä tausta paljastuisi.

**Pohja lasketaan, ei arvata.** `taysi` on se zoom jolla maailma
(256·2^z px) juuri täyttää ruudun, ja jousto rajataan aina sen
yläpuolelle. iPhonella pelivaraa on 1,8 tasoa, joten 0,30 ei voi
paljastaa mitään — mutta poikkeavalla ruudulla (hyvin korkea ikkuna)
raja sitoo ja jousto kutistuu itsestään nollaan.

### Paikkaus osuu `getScaleZoom`iin, ei `_move`en

Tämä ei ole makuasia. `TouchZoom._onTouchMove` laskee **ensin** zoomin ja
**vasta sitten** keskipisteen samasta luvusta:

```js
this._zoom   = map.getScaleZoom(scale, this._startZoom);
this._center = map.unproject(map.project(pinchStart, this._zoom)...);
```

Jos zoom puristettaisiin vasta `_move`ssa, keskipiste olisi laskettu
puristamattomalla luvulla ja **ankkuri sormien alla valuisi**.
`getScaleZoom`issa molemmat tulevat samasta luvusta.

Paikkaus on voimassa vain `_nipistysKesken`in aikana. Ohjelmalliset
polut rajaavat jo `_limitZoom`illa ennen tänne tuloa, eikä niihin kuulu
joustoa.

### Vastus alkaa ENNEN rajaa

Pelkkä jousto rajan alapuolella tarkoittaa että kartta liikkuu sormen
mukana täydellä nopeudella rajalle asti ja pysähtyy vasta siinä. Se
tuntuu töksähdykseltä vaikka pysähdys itse olisi pehmeä — **muutos
nopeudessa on äkillinen, ei sijainnissa.**

Apple Mapsissa ja iOS:n vierityksessä hidastus alkaa jo ennen reunaa:
viimeinen matka kuljetaan hitaammin, jolloin pysähdys on jo tapahtunut
kun reuna tulee. Sama tässä, kaksi vaihetta:

```
PEHMEA = 0,60 zoomtasoa rajan yläpuolella   kuutiollinen jarrutus, 1 -> K
K      = 0,35                               nopeus rajalla
YLI_MAX= 0,30 zoomtasoa rajan alapuolella   asymptoottinen jousto
```

Kuutio on valittu neljästä ehdosta niin että **koko kuvaus on C1-jatkuva**:

| | vaatimus | toteutuu |
|---|---|---|
| `g(0)` | 0 | 0,0000 |
| `g(1)` | 1 | 1,0000 |
| `g'(1)` | 1 — ei nykäystä kaistan alkaessa | 1,0000 |
| `g'(0)` | K — sama kuin jouston alkunopeus | 0,3500 |

Derivaatta on koko kaistalla positiivinen (pienin 0,35), eli kuvaus on
monotoninen eikä kartta voi liikkua väärään suuntaan. Jouston derivaatta
rajalla on niin ikään K, joten siirtymä kaistalta joustoon on sekin
sileä. **Kartta pysähtyy tuntumaan ennen kuin se pysähtyy.**

### Palautus tulee ilmaiseksi

Molemmat zoom-eleet päättyvät `_limitZoom`iin — TouchZoomin oma
`_onTouchEnd` ja tuplanapautuksen `paataEle` — joten kartta liukuu
takaisin rajalle Leafletin omalla 250 ms siirtymällä. Mitään omaa
jousiaimaatiota ei tarvittu.

Tuplanapauta-ja-vedä leikkasi ennen alarajan itse (`Math.max(getMinZoom(),
…)`), eli se pysähtyi kovaan seinään samalla kun nipistys lensi läpi.
Leikkaus poistettiin, joten **molemmat eleet tuntuvat rajalla
samalta** — mitattuna 0,276 ja 0,268 tasoa joustoa, molemmilla 0 %
paljasta.

### Mitä tämä mittari EI kerro

`setZoom`, `zoomOut` ja rulla näyttävät mittarissa 45–100 % "paljasta
taustaa" **sekä ennen että jälkeen** korjauksen. Se ei ole zoom-raja
vaan laattojen häivytys: mittari laskee paljaaksi laatan jonka
`opacity < 0,05`, ja ohjelmallisen zoomin jälkeen uudet laatat ovat
hetken juuri siinä tilassa. Zoom ei näillä reiteillä mene rajan ali
kertaakaan (`ali 0,000`). Jos tätä mitataan uudelleen, erottele
laattojen häivytys zoom-rajasta — muuten korjaus näyttää tehottomalta.

## Kerrosten tahti eleen jälkeen — mitattu, ja lopputulos yllätti

Käyttäjän havainto oli että kartan kerrokset päivittyvät zoomissa ja
siirrossa eri aikaan, ja jokainen askel lukee erillisenä välähdyksenä.
Tästä oli tarkoitus rakentaa atominen vaihto: uusi tila valmistellaan
taustalla ja otetaan käyttöön kaikille kerroksille samassa ruudussa,
enintään 150 ms viiveellä.

Mittari rakennettiin ensin, ja se muutti tehtävän.

### Mittari

Jokaisesta kerroksesta luetaan ruutukohtainen **allekirjoitus** —
merkkijono joka muuttuu tasan silloin kun kerros muuttuu näkyvästi.
Kerroksen valmis-hetki on VIIMEINEN ruutu jolla allekirjoitus vielä
muuttui, mitattuna **eleen lopusta** (ei alusta: kylmällä polulla
ensimmäinen ele kesti 26 s ja peitti alleen kaiken muun). Lisäksi
lasketaan montako kertaa kukin kerros vaihtui ja **montako eri ruutua**
sisälsi jonkin oman kerroksen vaihdon.

Allekirjoitukset: laattojen näkyvä määrä, `WindTexture.askel` +
mitat + rajat, `PohjaTekstuuri` + sen läpinäkyvyys, `State.windField`
pituus + näytearvot, markkeripaneelin lapsimäärä + ensimmäisen sijainti,
kapselin tekstisisältö.

Mittari ei koske sovelluskoodiin, joten lähtötaso mitattiin tuotannon
koodilla sellaisenaan.

### Tulos

CPU 4×, verkkoviive 300 ms, mediaani kolmesta ajosta, aika sormen
noususta. Solu = *milloin valmis ms / montako kertaa vaihtui*.

```
  tapaus            laatat    lampo    pohja   kentta   merkit  lukemat   HAJONTA  vaihtoja
  nipistys sisaan   3568/1   3249/1      0/0      0/0   3249/1   3249/1      3568         1
  nipistys ulos     2043/2    999/1      0/0    999/1    999/1    999/1      2043         1
  heitto sivulle       0/0    695/1    695/1    695/1      0/0    695/1       695         1
  setZoom -2        1562/2    607/1      0/0   1180/1    607/1   1180/2      1562         2
```

**Sovelluksen omat kerrokset vaihtuvat jo nyt yhdessä ruudussa.**
Lämpökartta, tuulikenttä, spottimerkit ja kapselin lukemat osuvat
samaan millisekuntiin (3249, 999, 695) kolmessa tapauksessa neljästä,
koska ne roikkuvat samassa ketjussa: `_rakennaKentta` → `buildWindField`
→ `drawColorField` + `resetParticles` + `Crosshair.refresh` ajetaan
yhtenä synkronisena jaksona haun ratkettua. Atomista vaihtoporttia ei
siis tarvita — se olisi ollut satojen rivien refaktorointi ongelmaan
jota ei ole.

Jäljelle jää kaksi asiaa, ja kumpikaan ei ole korjattavissa 150 ms
budjetilla:

1. **Pohjakartan laatat saapuvat 300–1400 ms muita myöhemmin.** Se on
   verkko ja dekoodaus. Laattojen odottaminen tarkoittaisi koko kuvan
   pidättämistä sekunniksi tai yli.
2. **`setZoom` on kaksivaiheinen** (`vaihtoja 2`): lämpökartta terävöityy
   607 ms:ssä paikallisesti, ja uusi säädata saapuu 1180 ms:ssä. Väli on
   570 ms eli reilusti yli budjetin, joten säännön mukaan kerros ei
   odota vaan vaihtaa yksin. Kapselin lukemat vaihtuvat samasta syystä
   kahdesti (`1180/2`): ensin välimuistin esikatselu, sitten tuore arvo.

### Kokeilu joka ei jäänyt: laattatason paljastus yhdessä ruudussa

Leaflet häivyttää jokaisen laatan sisään erikseen sitä mukaa kun se
valmistuu, joten uusi taso ei ilmesty kerralla vaan kasvaa palasina.
Kokeiltiin pitää uusi taso `opacity: 0`:ssa kunnes `load` kertoo sen
olevan kokonaan ladattu, ja paljastaa se yhdessä ruudussa (vartija
2 s:ssa sen varalta ettei `load` tule lainkaan).

Vuorotellen ajettu A/B, kolme kierrosta kumpaankin suuntaan:

```
  tapaus            versio   laattojen vaihtoja / ajo
  nipistys sisaan   vanha    1, 2, 2
                    uusi     2, 1, 2
  nipistys ulos     vanha    1, 1, 1
                    uusi     1, 1, 1
  setZoom -2        vanha    2, 1, 1
                    uusi     1, 1, 1
```

**Ei mitattavaa eroa.** Syy on mittarissa, ei välttämättä muutoksessa:
allekirjoitus laskee DOM-laattoja, ja piilotetun tason laatat latautuvat
silti — sen lisäksi `_pruneTiles` poistaa vanhoja laattoja 250 ms
`load`in jälkeen vaikka ne ovat jo peittyneet. Kumpikaan ei ole se mitä
käyttäjä näkee.

Oikea mittari olisi ruutukaappausten pikseliero. Se rakennettiin, mutta
4× kuristuksella `page.screenshot` aikakatkaisee kesken sarjan eikä
näytteenottoväli (~300 ms) riitä erottamaan 200 ms:n päässä toisistaan
olevia välähdyksiä. Muutos **peruttiin**: Leafletin sisuskalujen
paikkaus kartan kuumimmalla polulla ei mene tuotantoon ilman todistetta.

Jos joku palaa tähän: mittari ennen muutosta, ja mittarin on oltava
pikselipohjainen. Kevyempi tie on ottaa kaappaukset ilman
CPU-kuristusta ja kuristaa vain verkko — laattojen saapumisjärjestys
säilyy, ja kaappaus ehtii mukaan.

### Mitä tästä seuraa

Kerrosten yhtäaikaisuus on jo kunnossa siltä osin kuin sovellus sen
omistaa. Ainoa jäljellä oleva vipu on **budjetti**: jos vaihtoa saisi
pidättää sekunnin sijaan 150 ms:n, laattojen odottaminen tulisi
mahdolliseksi ja kuva vaihtuisi kirjaimellisesti kerran. Se on
käyttökokemuspäätös eikä tekninen — ja se on tehtävä laitteella, ei
mittarilla.
