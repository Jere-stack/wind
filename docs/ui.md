# Käyttöliittymä — Merikartta-paletti ja paneelit

Värit ja typografia, spottikortti, havaintoasemien kortit, aikajana, kapseli
ja yksittäiset ominaisuudet kuten puku, osuvuus ja aurinkokaari.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

## Valikoiden ulkoasu — Merikartta

Sovelluksessa on **kolme maailmaa**, ja raja kulkee sen mukaan mitä asia
on — ei sen mukaan missä se sijaitsee:

- **Tuulikenttä pitää värin.** Pohjakartta, lämpökartta ja partikkelit.
  **Sävy tarkoittaa tuulennopeutta, ja vain sitä.**
- **Mitattu data on tummaa pilleriä kartalla.** Havaintoasemien lukemat.
  Ne ovat lämpökartan päällä, joten niiden on oltava tummia — musteeksi
  vaihdettuna lukema katoaisi kokonaan.
- **Kaikki muu on paperia.** Paneelit, kartan päällä kelluvat esineet
  (kapseli, aikavalitsin), karttanapit, latausruutu — ja **spottimerkit**.

Sävyt on otettu suomalaisesta merikartasta: maa-alueen kellertävä pohja,
kartan musta teksti ja merikartan magenta. Magenta on `--accent`, siis
toimintoväri. Aiemmin se oli myös se sävy johon tuuliramppi päättyi
20 m/s kohdalla; värisokeuskorjauksen jälkeen rampin kärki on pinkki,
joten yhteys on nyt vain sukulaisuus eikä sama väri.

### Spottikortin migraatio

Spottikortti jäi pitkään ainoaksi pinnaksi jota ei ollut viety
Merikartta-paletille — kartta, asetukset ja ennustepaneeli mittasivat
0 alitusta, spottikortti 18. Nyt sekin on 0.

Löydökset olivat samaa perhettä eivätkä makuasioita:

- **`--muted` oli itse tumman teeman jäänne** (`rgba(180,215,255,.45)`,
  1,09:1). Se oli 13 paikassa, useimmiten "Ladataan…"-teksteissä. Token
  poistettiin ja käytöt korvattiin `--ink-3`:lla.
- **`--hairline` ja `--hairline-soft` olivat TEKSTIN värinä** viidessä
  paikassa ja koko tuntinauhassa (1,49:1). Ne ovat viivojen värejä; mennyt
  tunti vaimennetaan nyt musteasteikolla, joka on suunniteltu luettavaksi.
- **Kuvaajien tooltipeissä oli tumma tausta mutta muste tekstinä** —
  eli ne olivat lukukelvottomia. Puolittainen migraatio: sisältö oli
  viety paperille, pinta ei.
- **`--accent` oli datavärinä** Tuuli- ja Vesi-lukemissa. Aksentti on
  toimintoväri; asemavalitsin saa sen, lukema ei.
- **Kartan ramppi paneelissa**: puuskalukema käytti `ColorRamp.rgb()`:tä.
  Nyt `ink()`, kuten sääntö sanoo.
- **HAVAINNOT-ruudukossa oli neljä eri väriä** (oliivi, vaaleansininen,
  magenta, kartan ramppi). Nyt värillä on yksi merkitys: tuuli ja puuska
  kantavat musterampin, lämpö ja vesi ovat mustetta. Toinen väriasteikko
  samassa ruudukossa tekisi rampista merkityksettömän.
- **Virhepinnat** (`#toast`, `#rl-banner`) olivat vaaleaa oranssia ja
  punaista DM Monolla läpikuultavan sävytyksen päällä. Virheilmoitus on
  juuri se teksti jonka on pakko mennä perille: nyt paperia ja mustetta,
  ja virheellisyys tulee vasemman reunan varoitusviivasta.
- **Tuntinauhan reunahäivytys**: viimeinen lukema katkesi keskeltä
  numeroa ("19:0") ja näytti vialta. Sama keino kuin aikajanassa.
- **Emoji-taulukko poistettiin.** `_codes` oli pareja `[emoji, sana]`,
  mutta emojia ei renderöity enää missään — se oli ansa joka olisi
  palauttanut ne heti kun joku lukisi `info[0]`. Sanaakaan ei luettu:
  molemmissa lukijoissa oli `const info` jota ei käytetty. Nyt `_kuvaus`
  on sanat, ja sana on tuntisään ikonin `aria-label` — piirretty SVG ei
  muuten kerro ruudunlukijalle mitään.
- **Kuollut `buildWindRoseSVG`** (määritelty, ei kutsuttu) poistettiin.

### Kartan datakieli

Aiemmin kartalla oli **neljä kilpailevaa kieltä**: tummat pillerit
tuulelle, keltaiset pisteet (`#f5c842`) maa-asemille, mintunväriset aallot
(`#29e8a8`) vedenlämmölle ja sinivalkoiset ruksit sijainneille. Kolme
ensimmäistä olivat kategoriavärejä lämpökartan päällä, jonka oma väri taas
tarkoitti jotain. Kaikkien tasojen ollessa päällä ruudulla oli neljä
väriperhettä yhtä aikaa eikä yksikään niistä kertonut mitään.

Nyt kaikki lukemat jakavat **saman tumman pillerin ja saman vaalean
musteen** (`INK_1/INK_2/INK_3`). Ero syntyy **glyfistä**: tuuliviiri vs.
aalto. Toissijaiset asemat ovat pisteitä samassa musteessa — ero
ensisijaisiin on koko ja kirkkaus, ei sävy.

- **Asetusten tasolegenda näyttää glyfin, ei väripalloa.** Kun kartalta
  poistui väri, värilegenda olisi kertonut asiaa jota kartalla ei ole.
  Legendan glyfi on täsmälleen sama jonka merkki piirtää.
- **Tyhjä pilleri putoaa pisteeksi.** Vedenlämpöasema ilman lukemaa
  näytti ennen `~ — °C`, joka vie saman tilan kuin oikea lukema muttei
  kerro mitään.

### Spottimerkit ovat paperia

Sama spotti näytti ennen eri asialta kartalla (tumma levy, neonvihreä
rengas) ja ennustepaneelissa (paperi, mustekaari) — vaikka kyse on samasta
esineestä. Nyt kartan merkki on sama paperimerkki kuin paneelissa:
`spotMarkerSVG(..., paperi = true)` ja `spotIndexInk()`.

Kaksi syytä, joista jälkimmäinen on tärkeämpi:

1. **Sama esine näyttää samalta kaikkialla.**
2. **Neonvihreä `rgb(0,255,140)` oli sama sävy kuin lämpökartan 8 m/s.**
   Spotin pistemäärä ja tuulennopeus kilpailivat samasta sävystä, joten
   kumpikaan ei ollut luettava toisen päällä. Musteramppi on vaimea ja
   asuu paperilla, joten se ei osu lämpökartan kanssa yhteen.

**Nimikyltti ei ota indeksin väriä.** Merkki kertoo pisteet jo kahdesti
(kaaren pituus ja luku); kolmas kerros tekisi nimen luettavuudesta
indeksin panttivangin — matalan pistemäärän spotin nimi olisi harmaa.

### Väistö: kumpi spotti saa täyden merkin

Helsingin edustalla on kahdeksan spottia noin 20 km:n matkalla. Zoomilla 9
ne ovat ruudulla 30 px:n päässä toisistaan, eli renkaat menivät ristiin ja
luvut lukukelvottomiksi. Mitattuna **55,7 % renkaiden pinta-alasta oli
toisen renkaan alla zoomilla 8** ja 23,3 % zoomilla 9.

`_valitseTaydetSpotit()` tekee ahneen valinnan pistemäärän mukaan: kasan
paras saa täyden renkaan, muut kutistuvat pisteiksi. Mittaus väistön
jälkeen: **0 % kummallakin zoomilla.**

- **Mitään ei piiloteta.** Piste on yhtä lailla napautettava ja kertoo
  että spotti on siinä — luettavaksi vain tarjotaan se joka juuri nyt
  kannattaa lukea.
- **Kynnys on ruutupikseleissä**, joten kasat purkautuvat itsestään kun
  zoomaa lähemmäs.
- **Hävinnyt piste piirtyy renkaan ALLE** (`zIndexOffset: -1000`), muuten
  se jäisi puolittain renkaan päälle ja näyttäisi virheeltä.
- **Zoomatessa spotteja ei piirretä uudelleen** vaan skaalataan — se
  säilyttää animaation. Väistöjoukko kuitenkin riippuu zoomista, joten
  `_spotVaistoMuuttuisi()` tarkistaa erikseen muuttuisiko se, ja vain
  silloin ajetaan täysi `renderSpots()`.

### Tokenit

`:root`issa on `--surface / --surface-hi / --surface-lo`, `--hairline(-soft)`,
`--ink / --ink-2 / --ink-3`, `--accent`, `--info`. Kaikki musteet läpäisevät
WCAG AA:n kummallakin pinnalla (14.3 / 5.9 / 4.6 : 1).

Asiat jotka eivät ole ilmeisiä:

- **`--accent` on toiminto- ja varoitusväri, ei korostusväri.** Sääntö
  tarkennettiin kun spottikortti auditoitiin: magenta oli levinnyt kuuteen
  rooliin yhdellä kortilla (asemanimi, "Avomeri", UiRas-otsikko, kaavion
  maksimipiste, ennustepiikki, navinapit). Nyt se on varattu **toiminnoille**
  (navinapit, kytkimet) ja **tiloille jotka vaativat huomiota**
  (verkkotilan siru, mallien voimakas erimielisyys). Pelkkä nimilappu tai
  datapiste ei ole kumpaakaan — ne ovat mustetta. Se varataan kytkimille ja
  toiminnoille. Valittu valintasiru on **mustetta**, ei aksenttia: kolme
  siruryhmää näkyy yhtä aikaa, joten aksenttitäyttö toisi ruudulle kolme
  magentaa laattaa ja söisi tehon siitä missä se merkitsee jotain.
- **`var()` ei toimi SVG:n esitysattribuuteissa.** `fill="var(--ink)"` ei
  renderöidy. Kaavioiden ja renkaiden attribuuteissa on siksi literaalit;
  inline-tyyleissä (`style="color:…"`) tokenit toimivat normaalisti.
- **Emojit poistettiin** valintasiruista. Mallin nimi tekstinä on siistimpi
  kuin väärä ikoni, eikä uusia ikoneita tarvittu.

### Kaksi ramppia

`ColorRamp.rgb()` on kartalle, `ColorRamp.ink()` paneeleihin. Sama
sävypolku ja sama `msToT`, mutta **kirkkaus kulkee vastakkaisiin
suuntiin**: kartalla se nousee tuulen mukana (musta meri alla), musteessa
se laskee (beige paperi alla, L\* 44 → 13). Merkitys on molemmissa sama —
kovempi tuuli tarkoittaa enemmän kontrastia pohjaan. Mustevariantti on
4.52–13.1:1 molemmilla paneelipinnoilla.

**Mustevariantti ei ole värisokeusturvallinen eikä sitä saa siksi.**
Beigellä 4.5:1 kattaa L\*:n noin 44:ään, joten käytettävissä oleva
kirkkausväli on kolmasosa kartan välistä; deuteranoopille pienin dE jää
3.9:ään. Se on tässä hyväksyttävää, koska paneelissa väri on **aina luvun
vieressä** — data on numerossa ja väri vahvistaa sen. Kartalla väri on
ainoa koodaus, ja siksi juuri se ramppi tehtiin turvalliseksi. Älä siirrä
kartan turvallisuusvaatimusta musteeseen äläkä päinvastoin.

Mustevariantilla on nykyään **kolmas tehtävä**: vaalealla pohjakartalla se
on lämpökartan ramppi. Se ei ollut suunniteltua vaan seurausta siitä että
multiply-sekoitus kääntää kirkkaussuunnan — ks. *Kartan asetukset*. Siinä
roolissa se osoittautui mitattuna paremmaksi kuin kartan omat rampit, myös
värisokealle (6.3–7.2), koska paperia vasten signaali kulkee musteen
määrässä. **Jos musteramppia muuttaa, se muuttuu nyt kahdessa paikassa.**

Sama kaksijakoisuus pätee spotti-indeksiin: `spotIndexInk()` paneeleihin
ja `spotMarkerSVG(..., paperi)` vaihtaa renkaan taustan ja uran.
Indeksiasteikon suunta on tuulen suhteen käänteinen — iso pisteluku on
hyvä — joten se kulkee neutraalista kullan kautta vihreään ja turkoosiin.

**Indeksiasteikon yläpää on kylläisempi kuin alapää.** Se ei ole poikkeus
mustesäännöstä vaan sen soveltaminen: asteikko kulutti aiemmin
erottelukykynsä väärässä päässä. Mitattuna 25 vs 60 oli dE 34.2 mutta
60 vs 85 vain 9.3, ja koko ajettavalla alueella 60–100 pienin dE oli 3.7 —
kartalla kaksi hyvää spottia näyttivät samalta, mikä on juuri se vertailu
jota varten kartta avataan. Kroma romahti kärjessä (C50=27, C100=13).
Nyt kroma nousee loppuun (C100=30) ja kirkkaus 32 → 44; **60 vs 85 on
9.3 → 14.8**. Vaimea alapää on sama päätös toisin päin: huono keli ei
tarvitse huutaa.

Kärki on 5.13:1 merkin levyä vasten, eli kylläisyyttä ei voi enää nostaa
ilman että AA pettää. Siksi peräkkäisten 10 pisteen askelten minimi jää
4.4:ään — sitä ei kannata yrittää parantaa tällä pohjalla.

**Jos lisäät paneeliin tuulivärillisen luvun, käytä `ink()`-versiota.**
Kartan versio näyttää siellä siltä kuin teksti olisi haalistunut.

### Typografia

Syne ja DM Mono poistettiin. Käyttöliittymä käyttää järjestelmäfonttia
(iPhonella SF Pro), numerot samaa perhettä `tabular-nums`-asetuksella.
Kaksi ulkoista fonttilatausta vähemmän.

**Poisto oli pitkään kesken, ja se on syytä tietää.** Sävyt ja tyylit
vaihdettiin, mutta `body { font-family: 'Syne', sans-serif }` jäi paikalleen
ja `<head>` jäi lataamaan fontin Google Fontsista. Koska se oli tiedoston
**ainoa** `font-family`-sääntö, koko käyttöliittymä oli oikealla laitteella
Syneä — vaikka tämä luku sanoi toista. Kehitysympäristössä virhettä ei
näkynyt, koska fonttiosoitteeseen ei ollut yhteyttä ja selain putosi
varafonttiin: ruutukaappaukset näyttivät juuri siltä kuin dokumentaatio
lupasi. Nyt `body` pyytää järjestelmäpinoa ja fonttilinkit on poistettu.
Opetus: kun ulkoinen resurssi poistetaan, tarkista sekä sen linkki että
sitä käyttävä sääntö — ja muista että estetty verkko piilottaa juuri tämän
virheen.

### Aikavalitsin

Aikavalitsin on **säädin, ei paneeli**. Se oli 130 px + turva-alue eli 19 %
ruudusta, reunasta reunaan ulottuvana paperinauhana ja 72 px korkein
palkein — se luki toisena paneelina kartan alla ja peitti juuri sitä merta
jota sen pitäisi täydentää.

Nyt se on kelluva siru (`#tl-wrap::before`), jonka ohi kartta jatkuu
kummaltakin puolelta. Koko jalanjälki kuplan ylälaidasta ruudun pohjaan on
111 px eli 13 % (ennen 203 px / 24 %).

- **Palkit ovat 22 px, eivät 72.** Muodon lukemiseen ei tarvita korkeutta,
  koska palkkia verrataan naapuriin eikä asteikkoon. Kokeiltiin myös
  meteogrammikäyrää: se litistyy nauhan korkeudella lukukelvottomaksi,
  koska käyrä vaatii yhteisen nollatason jota pitää seurata silmällä.
- **Kupla on yksirivinen.** Kaksirivinen oli 39 px ja sen magenta päiväys
  oli koko valitsimen äänekkäin elementti. Päiväys näkyy jo janan
  päiväerottimessa, joten kupla tarvitsee vain viikonpäivän.
- **NYT-merkki on palkkien yläpuolella**, ei tuntirivillä — siellä se
  törmäsi lukemaan ("NYT15").
- **Play-nappi näyttää 32 px:ltä mutta osuu 44 px:n alalta**
  (`::after`-laajennus), eli Applen kosketusminimi täyttyy ilman että
  säädin lihoo.
- **`TICK_W` JS:ssä ja `.htick` flex-basis CSS:ssä on pidettävä samana**,
  muuten keskitys valuu.

### Yläreuna — kapseli

Yläreunassa on **tasan yksi esine**: kelluva kapseli kartan päällä.

Sitä ennen tässä oli kolme esinettä (sääsiru, tähtäimen lukema,
tuuliasteikko) kolmella eri korkeudella, sitten koko leveyden infopaneeli,
sitten kaksi neljännesympyrää yläkulmissa. Kaaret toimivat, mutta niiden
säde oli sidottu sisältöön kaavalla `√(R²−y²)`: jokainen tekstin muutos
pakotti laskemaan säteen uudelleen ja leikkaamaan alarivit kaareen.
Kaaret veivät 10,7 % ruudusta, kapseli vie 4,3 %.

Ratkaiseva havainto koko sarjan taustalla: **sääsiru ja tuulilukema
kuvasivat samaa pistettä** — molemmat lukevat `map.getCenter()`. Siksi ne
kuuluvat samaan esineeseen.

**Kolme osaa vasemmalta oikealle: suunta, tuuli, sää.** Jako on tekemisen
mukaan — suunta kertoo mistä, tuuli kuinka kovaa, sää millaista — ja kaksi
hiusviivaa erottavat ryhmät niin ettei rivi lue yhtenä jonona. Kapselin
leveys ei ole sidottu mihinkään: rivi kasvaa ja kutistuu sisällön mukana.

- **Puuska on harmaa eikä rampin värinen**, vaikka se on tuulitieto. Jos
  molemmat luvut ovat värillisiä ja saman kokoisia, silmä ei tiedä kumpaa
  katsoa. Väri varataan sille luvulle joka kertoo pääseekö vesille.
  Puuska on 10,5 px `--ink-3`, keskituuli 23 px rampin musteella.
- **Puuska on nimetty.** Kokeiltiin nimeämätöntä pikkulukua ja pinottua
  saraketta (yksikkö päällä, puuska alla): zoomattuna jälkimmäinen lukee
  murtolukuna. Sana on lyhyempi kuin sen selittäminen jälkikäteen.
- **Ei ajatusviivaa.** `7.9–11.7 m/s` luetaan välinä, mutta väli vaatii
  tasavahvat luvut — pienennetty jälkiosa rikkoo juuri sen lukutavan.
  Joko väli tasavahvana tai puuska erillisenä; ei molempia.
- **Puuskarivi säilyttää tilansa** (`visibility` eikä `display`) kun
  puuskatietoa ei ole, jottei kapselin korkeus hyppisi sen mukaan onko
  lähimmällä ennustepisteellä puuskaa.
- **`width: max-content`** on pakollinen. Kiinteä sijoitus + `left: 50%`
  ilman `right`ia antaa käytettäväksi vain ruudun oikean puoliskon
  (195 px), jolloin lukema katkeaa kahdelle riville. Testattu 320 px:iin
  asti kaikilla yksiköillä: levein sisältö on 254 px.
- **Sanallinen sääkuvaus jäi pois.** Ikoni kertoo sään, ja "tiheitä
  lumikuuroja" leventäisi kapselia kolmanneksella. Sana on tuntisäässä.
- **Suunnan nuoli on piirretty SVG.** Vanha `dirArrow()` kvantisoi
  kahdeksaan suuntaan: 194° näytti samalta kuin 180°. Nuoli kääntyy
  `rotate(dir + 180)` — plus 180, koska `dir` on suunta josta tuulee ja
  nuoli osoittaa siihen minne tuuli puhaltaa.

**Läpikuultavuus on mitattu pois.** iOS-tyylinen materiaali (läpikuultava
pinta + `backdrop-filter`) siirtää beigeä tuulen mukana dE 7,5–11,9 vielä
90 %:n pinnalla — kartan vihreällä siitä tulee salvia, myrskyllä
vaaleanpunainen — ja `--ink-3` putoaa alle AA:n **jokaisella** alfalla,
koska sillä on kiinteälläkin pinnalla vain 4,6:1. Siedettävä siirtymä
vaatisi 96 %:n pinnan, jolloin itse ilmiö on näkymätön. Sweet spotia ei ole.

**Kaikki kolme osaa ovat napautettavia**, ja jokainen laajentaa oman
lukemansa: suunta avaa esitystavan, tuuli yksikön, sää tuntisään.
Kuuntelijat ovat painikkeissa eivätkä niiden sisällä olevissa lukemissa —
kahdella kuuntelijalla kupliva napautus laukaisisi `toggle()`:n kahdesti
eli ei kertaakaan.

### Kapselin valitsimet

Suunta- ja yksikkökortti ovat samaa muottia (`Valitsin`): sama paperi,
sama sijoituslogiikka, sama rakenne. Yhteinen tehdasfunktio tekee kolme
asiaa joita kahdella erillisellä toteutuksella ei saisi ilmaiseksi —
kortit eivät voi ajautua erinäköisiksi, toisen avaaminen sulkee toisen
ilman että ne tuntevat toisensa (`Valitsin.suljeKaikki`), ja uusi kortti
on muutaman rivin työ.

Kortti keskitetään **sen osan alle jota napautettiin**, ei koko kapselin
eikä ruudun keskelle: valikko kuuluu siihen mitä osoitettiin. Reunoille
jää 12 px, jottei kortti valu ulos kapean laitteen laidassa.

Rivin oikeassa laidassa on aina **sama lukema siinä muodossa jota rivi
tarjoaa**, joten kortti kertoo samalla mitä valinta tarkoittaa. Valittu
rivi on mustetäyttö kuten asetusten sirut, ei aksenttia.

### Suunnan esitystapa

Asteet tai ilmansuunta (`fs_suuntamuoto`). Kaksi muotoa tekevät eri työn
eivätkä ole toistensa hienompia versioita: **asteet antavat tarkkuuden,
nimi luettavuuden.**

- **Kirjainmuotoa (SSW) ei ole.** Se on asteita epätarkempi ja nimeä
  vaikeampi lukea, eli häviää kummallekin siinä mitä ne tekevät. Se olisi
  ollut helppo lisätä kolmanneksi riviksi juuri siksi ettei siitä
  tarvitse päättää mitään.
- **Nimet ovat ablatiivissa** ("lounaasta"), koska tuulen suunta on se
  josta tuulee. Nuoli osoittaa päinvastaiseen suuntaan (`rotate(dir+180)`)
  ja on aina ollut niin — sana ei tuo uutta ristiriitaa vaan sanoo
  ääneen sen minkä asteluku jättää arvattavaksi.
- **Nimet ovat kahdeksassa portaassa, asteet yhdessä.** Se on työnjako
  eikä epäjohdonmukaisuus: kuudentoista portaan nimi olisi
  "etelälounaasta" — pidempi kuin lukema jonka se korvaa.
- Pisin nimi ("pohjoisesta") mahtuu 320 px:n laitteelle levein
  mahdollinen muu sisältö rinnalla: kapseli on silloin 246 px.

### Yksikkövalitsin

Oli viimeinen tumman teeman jäänne: pohjaton pillerilista keskellä ruutua,
DM Monolla ja valkoisella tekstillä varjostettuna — paperilla valittu rivi
oli valkoista beigellä eli näkymätön. Nyt se on `Valitsin`-kortti muiden
joukossa, ja yksikön vieressä on **sama tuuli siinä yksikössä**
(`Units.fmtIn`).

## Mallien erimielisyys — tulkinta, ei uutta dataa

Spottikortin ennustekaavio hakee **jo** kolme vertailumallia (ECMWF, ICON,
GFS) yhdellä pyynnöllä ja piirtää ne katkoviivoiksi. Se mitä siitä puuttui
oli tulkinta: kolmen päällekkäisen viivan silmäily ei vastaa siihen
kysymykseen jota varten ne ovat — *voiko tähän lukemaan luottaa*.

`mallienHajonta()` laskee suurimman eron mallien välillä valittuna hetkenä
ja `hajontaTeksti()` kääntää sen lauseeksi. Rivi näkyy kahdessa paikassa:
kaaviossa legendan alla ja spottikortin herossa indeksin vieressä, koska
päätös tehdään siellä eikä kaaviota selatessa.

- **Ei yhtään uutta verkkopyyntöä.** Sama data joka juuri piirrettiin
  viivoiksi. Tämä oli myös syy olla toteuttamatta alkuperäistä ehdotusta
  sellaisenaan ("hae toinen malli") — se olisi ollut päällekkäinen haku.
- **Kynnykset ovat wingfoilauksen mittakaavasta**, eivät tilastollisia:
  alle 1,5 m/s ero ei muuta kalustovalintaa eikä päätöstä; yli 4 m/s voi
  tarkoittaa eroa "ei lähde vesille" ja "liian kova"; väli on se jossa
  kannattaa katsoa uudestaan lähempänä.
- **Hero-rivi on tyhjä kunnes data saapuu**, jotta kortti ei hyppää: rivi
  ei varaa tilaa ennen kuin sillä on sisältöä.
- Aikaikkuna on ±1,5 h valitusta hetkestä; sitä kauempaa ei kelpuuteta,
  koska mallien tuntiruudukot voivat olla eri vaiheessa.

Testattu syöttämällä vertailuvastaus proxyn ohi kolmella erolla (0,5 / 2,5
/ 6 m/s) — kaikki kolme kynnystä tuottavat oikean lauseen sekä herossa että
kaaviossa, ja 75 mallipolkua piirtyy.

**Ympäristöhuomio:** headless-selaimessa vertailupyyntö kaatuu usein
`net::ERR_CONNECTION_RESET`-virheeseen, vaikka sama osoite toimii curlilla
ja palauttaa oikeat avaimet. Sovellus tekee käynnistyksessä ~169
API-pyyntöä, ja tämä yksittäinen pyyntö lähtee niiden perään. Älä tulkitse
tyhjää vertailukaaviota sovelluksen viaksi ennen kuin olet syöttänyt
vastauksen testissä.

## Suosikit ja jaettava linkki

**Suosikit** (`Suosikit`, localStorage `fs_suosikit`) vaikuttavat kolmeen
asiaan: kartta avautuu niiden kohdalle oletusnäkymän sijaan, suosikki
piirtyy **aina täytenä merkkinä**, ja kortissa on tähti jolla sen vaihtaa.

- **Merkin etusija on se joka oikeasti merkitsee.** Merkit kilpailevat
  tilasta (`_valitseTaydetSpotit`), ja Helsingin edustalla spotit ovat
  lähekkäin — ilman etusijaa oma kotispotti katoaa pisteeksi juuri siksi
  että naapurilla sattuu olemaan parempi lukema.
- **Tallennus on nimilistana, ei indekseinä.** `SPOTS`-taulukon järjestys
  voi muuttua, ja indeksi osoittaisi silloin väärään spottiin.
- Yksi suosikki → `setView` zoomilla 10, useampi → `fitBounds`
  `maxZoom: 11`. Sitä lähempää yksi spotti täyttää ruudun eikä kentästä näy
  mitään.

**Jaettava linkki** (`Linkkitila`) kirjoittaa katsotun spotin ja hetken
osoitteen hash-osaan, ja jakonappi kopioi osoitteen leikepöydälle.

- **Aika on ISO-leima, ei tuntinumero.** Tuntinumero on indeksi
  ennustesarjaan, ja sarja alkaa eri kohdasta joka latauksella —
  vastaanottajalla se osoittaisi eri hetkeen. Mitattu päästä päähän:
  lähetetty `2026-08-20T01:00` (idx 40) avautui vastaanottajalla samaan
  aikaan, vaikka indeksi ratkaistiin uudelleen.
- **Hash eikä query**, koska se ei aiheuta uudelleenlatausta eikä vaadi
  palvelimelta mitään.
- **Linkki voittaa suosikit, suosikit voittavat oletusnäkymän.** Jos joku
  lähetti linkin, hän tarkoitti juuri sitä spottia.
- `indeksiAjalle` hyväksyy enintään 2 h poikkeaman; kauempaa ei kelpuuteta,
  koska silloin linkki osoittaisi eri kelin kuin lähettäjä näki.
- Leikepöytä vaatii suojatun yhteyden eikä ole kaikkialla — jos kopiointi
  ei onnistu, osoite näytetään toastissa jotta sen voi ottaa käsin.

## Puvun paksuus

`pukuSuositus(vesiC, ilmaC, ms)` kääntää kolme lukua yhdeksi päätökseksi.
Kortti näytti vedenlämmön, ilman ja tuulen mutta ei sitä mitä niistä
seuraa; suositus on veden lämpötilakortin vieressä, koska siinä kohtaa
vedenlämpöä katsotaan.

- **Vesi on hallitseva mutta ei yksin riitä.** Kylmä ilma ja kova tuuli
  jäähdyttävät märkäpuvun pinnasta koko session ajan, ja juuri se erottaa
  mukavan ja palelevan kelin samalla vedenlämmöllä. Korjaus on neljäsosa
  vesi/ilma-erosta plus enintään kaksi astetta tuulesta.
- **Korjaus on tarkoituksella maltillinen.** Tämä on lähtökohta
  pukukaapilla, ei mittaustulos.
- **Kylmin luokka on kuivapuku.** Alle 8 °C tehollisessa märkäpuvun
  paksuuden hienosäätö ei ole enää oikea kysymys.
- **Ilman vedenlämpöä ei anneta suositusta** — kortti jää silloin kokonaan
  pois. Tämä on tavallista: kehitysympäristössä `loadMarineTemp` ei saa
  dataa lainkaan, ja 0/12 spottia oli ilman vedenlämpöä.

Mitattu kaavan rajat (vesi/ilma/tuuli → puku): 22/22/6 shortsit,
18/18/6 2 mm, 15/15/6 3/2, 12/12/6 4/3, 9/9/6 5/4, 5/5/6 kuivapuku;
15/5/16 pudottaa tehollisen 11,3:een eli 4/3:een.

Testikuoppa jonka jo kerran astuin: `.sh-stat-label` on CSS:llä
`text-transform: uppercase`, joten `innerText` palauttaa "PUKU" eikä
"Puku". Testin `/^Puku/` ei osunut, ja näytti siltä ettei kortti
renderöidy vaikka se oli DOM:issa.

## Ennusteen osuvuus havaintoja vasten

`Osuvuus` (localStorage `fs_osuvuus`) tallentaa ennuste–havainto-pareja ja
kertoo onko ennuste **tällä spotilla** systemaattisesti pielessä. Rannikolla
se on tavallista: maasto ja suojaisuus tekevät paikallisen poikkeaman jota
2,5 km hila ei tavoita. Sovellus näytti ennusteen ja havainnon vierekkäin
mutta heitti vertailun pois kortin sulkeutuessa.

- **Vertailu tehdään NYKYHETKEN tuntiin, ei valittuun.** Valitun tunnin
  ennusteelle ei ole havaintoa.
- **Tunti yksilöi näytteen**, joten sama tunti kirjataan kerran vaikka
  kortti avattaisiin monta kertaa.
- **Epäuskottava havainto hylätään** (alle 0 tai yli 45 m/s).
- **Alle viidellä näytteellä ei sanota mitään**, ja alle 0,5 m/s poikkeama
  esitetään osumana eikä virheenä — se ei muuta kalustovalintaa.
- Katto on 60 näytettä per spotti ja 30 vrk ikä.
- Tallennus on paikallinen: se on tämän laitteen kokemus tästä spotista,
  eikä sitä jaeta mihinkään.

**Kirjaus on kahdessa kohdassa**, koska havainto saapuu kahta reittiä:
tuoreena hakuna ja välimuistista (`CURRENT_TTL` 10 min). Välimuistihaarassa
uutta paria ei synny, mutta rivi pitää silti piirtää.

Sudenkuoppa joka maksoi kierroksen: kirjoitin kirjauksen ensin
`renderFmi`-funktioon, joka näytti oikealta paikalta — mutta sitä ympäröivä
`buildFmiCard` **on määritelty eikä sitä kutsuta koskaan**. Koko ominaisuus
olisi ollut hiljaa kuollut. Kun tähän tiedostoon lisää kytkennän, tarkista
`grep -c` että ympäröivää funktiota oikeasti kutsutaan.

Mitattu: alle minimin ei tekstiä; +2 → "liian kova"; −3 → "liian heikko";
0,2 → "osunut hyvin"; duplikaatti torjutaan; 99 m/s hylätään; 80 kirjausta
→ 60 talletettua. Kortissa rivi renderöityy oikeassa polussa.

## Spottikortin auditointi ja korjaukset

Kortti auditoitiin kokonaan: rakenne koodista, mitattu DOM ja silmämääräinen
tarkastus koko pituudelta. Löydökset ja korjaukset ovat commit-historiassa;
tässä ne joista jää pysyvä sääntö.

**Havaintoasema ratkaistaan yhdessä paikassa.** Kortti näytti aiemmin kaksi
eri asemaa yhtä aikaa (tilastossa lähin, kaaviossa lähin jolla on dataa),
eri lukemin ja ilman selitystä. `_fmiLoadWithFallback` on nyt ainoa
auktoriteetti, koska se on ainoa joka tietää mistä dataa oikeasti saa.
**Jos lisäät korttiin havaintoperäisen kentän, lue se samasta ratkaisusta.**

**`HAVAINTO_MAX_KM = 30`.** Asemalista kattaa pääkaupunkiseudun; Hangon
spoteille lähin on 107–112 km eli eri sääjärjestelmä. Sen yli havaintoa ei
esitetä lainkaan vaan kerrotaan puuttuminen. Tyhjä on rehellisempi kuin
väärä — ja tämä on sama sääntö kuin puvulla ja osuvuudella.

**Sessioikkunan rajat 6 ja 18 m/s tulevat `foilBadge`sta**, eivät erillisestä
vakiosta. Sama määritelmä kahdessa paikassa olisi kahden totuuden alku: jos
kynnyksiä muuttaa, muuta `foilBadge`a ja ikkuna seuraa.

**Tilastokortteja on neljä, ei viisi.** Ruudukko on `repeat(4, 1fr)`, joten
viides jättäisi orvon rivin ja kolme tyhjää solua. Tuuli ja puuska ovat
yhdessä kortissa koska ne ovat sama mittaus samalta asemalta.

Mitattu kortti ennen → jälkeen: **1 148 px → 1 086 px**, aurinkokaari
122 → 83 px, tilastorivit 2 → 1, iso lukema 52 → 38 px ja indeksirengas
48 → 64 px.


## Play ja kapseli — mikä päivittyy mistä

Kapselin tuuli, suunta ja puuska ovat `Crosshair`in, lämpötila
`WeatherWidget`in. Molemmat päivittyvät normaalisti `buildWindField`in
lopusta — mutta **vain kun kutsussa ei ole `scrub`-lippua**:

```js
if (!(opts && opts.scrub)) { Crosshair.refresh(); WeatherWidget.refresh(); }
```

Scrub jättää ne tarkoituksella väliin, jotta sormea seuratessa ei tehdä
turhaa työtä joka ruudussa; vahvistushetki (`_tlCommitSelection`) hoitaa ne.

**Play kulkee aina scrub-polkua eikä sillä ole vahvistushetkeä**, joten
ilman erillistä kutsua kapseli jäätyi koko toiston ajaksi. Mitattuna: play
eteni kahdeksan tuntia, aikakupla ja kartta seurasivat, mutta kapselin
kaikki neljä lukemaa pysyivät ennallaan. Nyt `_playSijainti` kutsuu
molemmat kerran tuntiaskelta kohti — ei joka ruudussa, koska ne lukevat
valmista tekstuuria eivätkä hae verkosta mutta turhaa työtä ei silti tehdä.

**Jos lisäät kapseliin tai tähtäimeen jotain, tarkista molemmat polut:**
`buildWindField`in ei-scrub-haara *ja* `_playSijainti`. Pelkkä ensimmäinen
näyttää toimivan kaikessa käsin tehdyssä testauksessa.

### Puku ja vesi samasta lähteestä

`_paivitaPuku` sitoo pukusuosituksen siihen lämpötilaan joka VESI-korttiin
kirjoitetaan. **Alkurenderöinti ei saa arvata sitä muualta:** UiRas-spoteilla
`vesiNum` jätetään nulliksi, koska VESI tulee niillä UiRas-asemalta joka
vastaa vasta myöhemmin. Jos puku laskettaisiin siinä välissä marine-API:n
`_waterTemp`-arvosta, kortti näyttäisi yhtä aikaa "VESI —" ja "PUKU 3/2 mm"
— ja pysyvästi, jos UiRas ei vastaa. Mitattuna juuri niin kävi.

## Aikajana kotivalikon appissa

Selaimessa `env(safe-area-inset-bottom)` on iPhonella nolla, koska Safarin
alapalkki vie sen tilan. Kotivalikon appissa palkkia ei ole ja sama inset on
34 px kotinäppäimelle — ja koska aikajana lisää sen alareunaansa, se
**nostaa** aikajanaa saman verran. Mitattuna rako ruudun pohjaan 8 px → 42 px.

Aikajanalla on nyt oma token `--sab-tl`, joka on oletuksena sama kuin `--sab`
mutta standalone-tilassa 14 px:

```
                              --sab-tl   rako pohjaan   play-napin ala
selain (Safari)                  0 px        8 px           19 px
standalone ennen                34 px       42 px           53 px
standalone nyt                  14 px       22 px           33 px
```

Selainversio ei muutu lainkaan. Standalone laskee 20 px ja play-nappi jää
33 px:n päähän pohjasta eli selvästi irti kotinäppäimestä.

**Kaikki neljä aikajanan osaa on vaihdettava yhdessä.** Ensimmäinen versio
vaihtoi vain `#tl-wrap`in, jolloin `.tl-play-btn` ja `#tl-indicator` jäivät
`--sab`:iin — mitattuna siru olisi ollut 22 px:ssä ja nappi 53 px:ssä, eli
ne olisivat erkaantuneet toisistaan. Myös `#rl-banner` kelluu aikajanan
yläpuolella ja käyttää samaa tokenia, jottei väli muutu.

Tunnistus on kahdesti: `@media (display-mode: standalone)` kattaa nykyiset
selaimet ja `.standalone`-luokka (bootissa `navigator.standalone`) vanhemman
iOS:n. Paneelien `padding-bottom` pitää edelleen koko `--sab`:in — ne ovat
vieritettävää sisältöä jonka on kierrettävä kotinäppäin.

## Havaintoasemien kortit — mitä FMI antaa ja mitä siitä näytettiin

Käyttäjä kysyi miksi Vuosaaren asemalla ei näy kartalla dataa. Vastaus ei
ollut koodissa vaan asemassa — mutta koodi teki siitä kolme eri vikaa.

### Vuosaari: asema on hiljaa, eikä sitä sanottu

FMISID **151028 (Helsinki Vuosaari satama)** lakkasi lähettämästä
**18.8.2026 klo 10:00 UTC**. Mitattuna kahden vuorokauden ikkunoissa:

```
1.–3.8.    98 riviä, kaikki kelvollisia
10.–12.8.  98 riviä, kaikki kelvollisia
17.–19.8.  98 riviä, 70 kelvollista   ← katko alkaa 18.8. klo 11
20.–22.8.   0 riviä
22.–24.8.   0 riviä
```

Asema on FMI:n rekisterissä yhä auki (`Automaattinen sääasema`), joten
kyseessä on anturikatko eikä lakkautus. Lähin **toimiva** tuuliasema on
Sipoo Itätoukki 12,0 km päässä; Vuosaaren satamassa ei ole toista
tuulihavaintoa (0,1 km:n päässä oleva 104089 on kolmannen osapuolen
ilmanlaatuasema eikä vastaa säähakuun lainkaan).

Mitä sovellus teki väärin:

- **Kartalla** merkki oli mykkä. `_fmiLoadWithFallback` kutsuttiin yhden
  aseman listalla, joten varatietä ei ollut, ja epäonnistuminen jätti
  pillerin tyhjäksi. Tyhjä pilleri näyttää samalta kuin lataamaton — ei
  voinut päätellä oliko vika asemassa, verkossa vai sovelluksessa.
- **Kortissa** sijaisuus tehtiin **hiljaa**. Otsikossa luki "Helsinki
  Vuosaari satama", herossa Itätoukin lukema, ja ainoa vihje oli
  8 px harmaa rivi kaavion alla jossa luki toisen aseman nimi. Se on
  pahempi kuin tyhjä kortti: se on väärä vastaus oikean näköisenä.
- **Historiaikkuna oli 24 h**, joten Vuosaaren omaa dataa ei löytynyt
  vaikka sitä on. 168 tunnin ikkunalla se löytyy — ja siinä on koko juttu:
  aseman viimeiset tunnit ovat yhä katsomisen arvoisia.

Korjaus on kolmiosainen:

1. **API kertoo iän.** `ageMin` ja `lastIso` sekä uusimmassa havainnossa
   että historiassa. Ilman sitä käyttöliittymä ei voi erottaa "hiljainen
   asema" -tilaa "asemaa ei ole" -tilasta.
2. **Kartan merkki kertoo tilansa**: katkoviiva, himmennys ja teksti
   "ei signaalia" pillerin lukeman tilalla (`_pilleri(..., hiljainen)`).
   Merkki jää kartalle, koska asema on oikeasti olemassa.
3. **Kortti näyttää aina sen aseman jota napautettiin.** Sijaisuus tulee
   vasta jos omalla asemalla ei ole dataa lainkaan seitsemään
   vuorokauteen — ja silloin otsikkokin vaihtuu. Hiljaisen aseman kortti
   näyttää oman datansa vanhana (hero 45 % peitteellä), sanoo milloin se
   päättyi, ja tarjoaa yhden painalluksen päässä lähimmän **tuoreen**
   aseman ("Nyt lähistöllä · Sipoo Itätoukki 12 km · 6.8 m/s").

`fetchMaritime`in bbox-varatie **poistettiin historiapolusta**: se olisi
palauttanut toisen aseman datan tämän aseman nimellä, eli tehnyt
palvelimella juuri sen minkä käyttöliittymästä poistettiin. Sijainen
valitaan nyt siellä missä se voidaan myös sanoa.

### Mitä FMI oikeasti antaa

Kaikki mitattu opendata.fmi.fi:stä, asema 105392:

| | timevaluepair | multipointcoverage |
|---|---|---|
| 7 vrk / 10 min / 3 parametria | 993 kt | **84 kt** |
| sama + lämpötila | — | 89,5 kt (gzip 11,9 kt) |

**Kaksitoistakertainen ero**, ja syy on formaatti: timevaluepair kirjoittaa
jokaisen arvon omaan `<wml2:point><wml2:MeasurementTVP>`-rakenteeseensa,
multipointcoverage on kaksi tekstiblokkia — aikaleimat ja luvut riveittäin.

Kaksi rajaa jotka kannattaa muistaa:

- **Aikaikkunan katto on 7 vrk.** 168 h menee läpi, 192 h vastaa
  `Too long time interval requested!`. Siksi kortin pisin jakso on 7 vrk
  eikä jokin pyöreämpi luku.
- **`timestep` on validoitu.** `timestep=180` palauttaa nolla riviä
  hiljaa, ei virhettä — sillä meni ensimmäinen "onko asema ollut hiljaa
  aiemminkin" -mittaus pieleen, kunnes sama ikkuna arvolla 60 antoi täyden
  datan.

**Suunta ja lämpötila olivat aina saatavilla** samalla 10 minuutin
tiheydellä; niitä ei vain pyydetty. Siksi kaavion tooltipin
suuntanuoli oli kuollutta koodia — `p.d` oli aina `null`.

Nyt `history=1` ottaa `hours`-parametrin (1…168, oletus 24) ja palauttaa
`ws` (suunnalla), `wg`, `ta` sekä `ageMin`. Kortti pyytää 168 h,
karttamerkit 24 h — merkit tarvitsevat historian vain aikajanan
liu'utukseen. Käynnistys **halpeni** silti, koska sama 24 h tulee nyt
kompaktissa muodossa: 25 kt (gzip 2,9 kt) aiemman 151 kt XML:n sijaan.

`api/kruunuvuori.js` sai saman `hours`-parametrin (oletus 30, katto 336).
Sen CSV kattaa noin 14 vrk kymmenen minuutin välein — dataa oli koko ajan,
sitä vain leikattiin 30 tuntiin siltä ajalta kun kortti näytti korkeintaan
vuorokauden.

### Kaavio: neljä suuretta, yksi akseli

**Suunta ei ole toinen y-akseli.** Asteet ja metrit sekunnissa eivät mahdu
samalle akselille ilman että kahden asteikon kohdistus keksitään, ja
keksitty kohdistus näyttää korrelaation jota datassa ei ole. Suunta on oma
nauhansa kuvan alla: **kulma kertoo suunnan, väri nopeuden.** Lämpötila on
samasta syystä vain lukemana ja tooltipissa, ei viivana.

**Puuska ei ole oma viivansa.** Vanha kaavio piirsi tuulen vihreällä
(`#2A702D`) ja puuskan oliivilla (`#7A5D07`). Mitattuna paneelin beigeä
vasten ne ovat normaalille näölle **dE 10,9** ja protanoopille **dE 3,6** —
käytännössä sama väri, eli viivat erosivat vain siinä että toinen oli
ylempänä. Eikä hyvää toista sävyä ole olemassakaan: tuuliviiva on
väriramppi joka käy läpi vihreän, kullan, oranssin ja magentan, joten mikä
tahansa kiinteä sävy törmää siihen jossain kohtaa asteikkoa.

Ratkaisu on **vaihtaa kanavaa**: puuska on vyöhyke tuuliviivan yläpuolella.
Vyöhykkeen paksuus *on* puuskaisuus — juuri se mitä foilaaja kaaviosta
lukee — eikä sitä tarvitse päätellä kahden samanvärisen viivan
välimatkasta. Selitteessä tuulen avain on **sama gradientti kuin viiva**,
koska viivalla ei ole yhtä väriä.

**Harvennus säilyttää huiput.** 7 vrk on 1008 havaintoa noin 300 pikselille.
Joka n:nnen pisteen poiminta hukkaisi puuskapiikit — ja piikit ovat se syy
miksi kaaviota katsotaan. Siksi data niputetaan: viiva on nipun keskiarvo,
vyöhyke nipun pienimmästä tuulesta suurimpaan puuskaan. Kuudella tunnilla
nippuun osuu yksi havainto ja vyöhyke kutistuu luonnostaan tuulen ja
puuskan väliksi.

Asiat jotka eivät ole ilmeisiä:

- **Suuntien keskiarvo on ympyrällä.** 350° ja 10° ovat 20° päässä
  toisistaan, mutta niiden aritmeettinen keskiarvo on 180° eli täsmälleen
  väärään suuntaan. `_havSuuntaKeskiarvo` summaa yksikkövektorit.
- **Yksi nuoli on koko välinsä**, ei yksi nippu. Muuten 7 vrk:n nauha olisi
  kymmenen satunnaista pistenäytettä tuhannesta havainnosta: nuoli
  näyttäisi kertovan päivän suunnan, vaikka se kertoisi puolentoista
  tunnin suunnan sattumanvaraisesta kohdasta.
- **X-akselin merkinnät valitaan AJASTA, ei nipun indeksistä.** Ensimmäinen
  versio etsi nippuja joiden keskihetki osuu tasatunnille — ja 7 vrk:n
  jaksossa yksi nippu on puolitoista tuntia, joten tasatunnille ei osu
  kukaan. Akselilla luki "ke 19. pe 21. la 22. ma 24.": kolme päivää
  seitsemästä puuttui ilman mitään sääntöä.
- **Yli 30 h merkitään päivinä.** Pelkkä kellonaika on silloin
  kaksiselitteinen: "12 00 12 00 12" ei kerro mistä päivästä on kyse.
  Keskiyön kohdalla on jo pystyviiva, joten päivän nimi ankkuroidaan
  keskipäivään.
- **`var nayta` varjosti `function nayta`.** X-akselisilmukan boolean ja
  tooltipin funktio olivat samassa funktioskoopissa samannimisinä, joten
  hoistattu funktio korvautui booleanilla ja kosketus kaatui
  (`nayta is not a function`). Sen huomasi vain konsolista — kaavio
  näytti oikealta.
- **Vaakasuoran viivan gradientti tarvitsee `gradientUnits="userSpaceOnUse"`.**
  `<line>`-elementin rajauslaatikon korkeus on nolla, joten oletusarvoinen
  `objectBoundingBox` rappeutuu eikä gradientti näy lainkaan. Selitteen
  tuuliavain oli siksi ensin näkymätön.
- **Tooltip nousee ylös kun piste on alapuoliskossa.** Muuten se peittää
  suuntanauhan ja aikarivin, eli juuri ne kaksi asiaa joita samalla
  luetaan.
- **`ColorRamp.inkCss()`, ei `rgb()`.** Kortti on paperia (ks. *Kaksi
  ramppia*). Mustetaulu rakennetaan uudelleen kun väriasteikkoasetus
  vaihtuu, joten kaavio, nuolet, ruusu ja tilastoluvut seuraavat
  värisokeusramppia ilman omaa haaraa.

Tilastorivi (keskituuli, kovin puuska, vallitseva suunta, lämpötila) ja
suoraan merkityt ääriarvot ovat siellä siksi, että **tooltip saa täydentää
mutta ei portittaa**: jokainen luku on luettavissa myös koskematta
kaavioon. Tuuliruusu vastaa siihen mitä aikasarja ei kerro — onko tämä
pohjois- vai etelärannan paikka.

### Vesikaavio siirtyi paperille

`_uirasChartInteractive` oli jäänyt vanhaan tummaan palettiin: neonsyaani
viiva, syaanit ääriarvomerkinnät, magenta aseman nimi ja lähes musta
tooltip — beigen paneelin päällä. Sävyt vaihdettiin `--info`-tokeniin
(#1C5C86, dokumentoitu veden väri) ja musteisiin.

Samalla paljastui piilossa ollut vika: jaksovalitsimen **valittu** nappi
oli `var(--surface)` beige `var(--surface-hi)` lähes valkoisella, eli
1,1:1 — käytännössä näkymätön. Se ei näkynyt aiemmin, koska taustana oli
syaani lasitus. Nyt valittu on mustetta korotetulla pinnalla, sama kuin
tuulikaaviossa.

**`--accent` on edelleen ainoa toimintoväri.** Aseman nimi ei ole toiminto,
joten se on mustetta; valintamerkki ja valitsimen otsikko saavat pitää
aksentin.

## Tummat jäänteet paperipaneeleissa — ja miksi Helsinki näytti tyhjältä

Kaksi käyttäjän havaintoa, kolme eri vikaa. Kaikki mitattiin renderöidystä
sivusta: skripti kävelee jokaisen tekstisolmun, etsii sen *todellisen*
taustan (ylöspäin kunnes löytyy läpinäkymätön) ja laskee WCAG-suhteen.
Arvaamalla näitä ei löydä, koska tausta on usein eri elementissä kuin
teksti.

### Valikot avautuivat mustalla

`.fmi-dropdown-menu` oli `background: rgba(12,18,36,.98)` — lähes musta —
ja rivien teksti `var(--ink)` eli lähes mustaa. **Valikko oli luettava
vain siltä riviltä joka sattui olemaan `.selected`**, koska sen alla on
`--surface-lo`, joka maalasi tumman pois. Muut rivit olivat mustaa
mustalla. Se selittää myös "ekalla kerralla" -oireen: kun rivin valitsee,
se saa taustan ja alkaa näkyä.

Sama vika oli uimaveden asemavalikossa (`rgba(10,14,28,.98)`) ja se
korjattiin jo *Havaintoasemien kortit* -muutoksessa; tämä oli sen pari
jota ei silloin huomattu.

### Mitä mittari löysi lisää

Spottikortista löytyi kolme sarjaväriä ja neljä tilaväriä, jotka olivat
jääneet vanhasta tummasta teemasta:

```
                              beigellä (#F0E7CE)
mallivertailu ECMWF  #50B4FF        1.83 : 1
mallivertailu ICON   #FFC850        1.25 : 1
mallivertailu GFS    #C864FF        2.53 : 1
trendi ↑             #FFA050        1.64 : 1
trendi ↓             #50B4FF        1.83 : 1
puuskaisuus gusty    #FFC850        1.25 : 1
puuskaisuus extreme  #FF6450        2.37 : 1
"ei dataa" -viestit  rgba(255,100,100,.5–.7)  2.35–2.66 : 1
```

Yhdeksän eri kohtaa käytti punaista `rgba(255,100,100,…)` sanomaan "dataa
ei ole". Se ei ole virhe vaan tila, joten ne ovat nyt `--ink-3`.

### Kolmea erottuvaa sarjaväriä ei beigellä ole

Mallivertailun uudet sävyt ovat `#1C5C86` / `#A15A0E` / `#7A2E8F`
(5.82 / 4.27 / 6.51 : 1). Mutta mitattuna:

```
pari                normaali  protan  deutan  tritan
#1C5C86 / #A15A0E     23.1     19.0    23.6    20.3
#1C5C86 / #7A2E8F     16.7      6.4     1.6    13.8
#A15A0E / #7A2E8F     23.8     24.4    23.5    11.2
```

Sininen ja violetti ovat deuteranoopille **dE 1.6** eli sama väri. Tämä ei
korjaannu sävyä vaihtamalla: pinta on vaalea, joten kontrastivaatimus
pakottaa kaikki sarjat samaan kirkkausluokkaan, ja siinä luokassa
dikromaattinen erottelu romahtaa. Kokeiltiin viittä eri kolmikkoa —
jokaisessa vähintään yksi pari jäi alle rajan.

Ratkaisu on toinen kanava: **jokaisella mallilla on oma
katkoviivakuvionsa**, ja juuri se pari joka värinä sekoittuu on
kuvioltaan kauimpana toisistaan — ECMWF yhtenäinen, GFS pisteitä.
Selitteen avain piirtää saman kuvion, joten selite ei väitä että
mallit erottuisivat pelkällä värillä.

Yksi ansa: `MALLI_VIIVA.ecmwf` on `''` (yhtenäinen viiva), ja
`MALLI_VIIVA[key] || '5,3'` teki siitä katkoviivan — tyhjä merkkijono on
falsy. Sotki täsmälleen sen mallin jonka piti erottua kuviollaan.

### Helsingissä ei näkynyt FMI-havaintoja

Kaksi syytä, molemmat todellisia.

**1. Maa-asemat olivat piilossa, eikä valinta säilynyt.** Karttatasoissa
`'fmi-land': false`. Helsingin asemat — Kaisaniemi, Kumpula, Malmi,
Tapiola, Vantaa — ovat kaikki maa-asemia, ja lähin meriasema Harmaja on
10 km ulkomerellä. Kartta näytti tyhjältä juuri siellä missä käyttäjiä on
eniten. Lisäksi `_mapLayerState` ei tallentunut mihinkään, joten tason
kääntäminen päälle unohtui joka latauksella.

Nyt `fmi-land` on päällä oletuksena, tila muistetaan `fs_tasot`-avaimeen,
ja kytkinten ulkoasu luetaan tilasta eikä HTML:ään kirjoitetusta
oletuksesta.

**2. Maa-aseman lukemaa ei näytetty millään zoomilla.** `mkWindIcon`in
`isPrim` oli boolean: joko pilleri z8:sta ylöspäin tai pelkkä piste
ikuisesti. Maa-asemat olivat jälkimmäisiä, eli niiden lukeman sai näkyviin
vain napauttamalla.

`isPrim` korvattiin `pilleriZ`:llä — se zoom jolla lukema ilmestyy.
Meri 8, maa 10. Porrastus on tarkoituksellinen: meri on se mitä foilaaja
katsoo, mutta kaupunkiin zoomatessa myös maa-aseman lukema on luettavissa.
Mitattuna Helsingin keskustan yllä:

```
       ennen        jälkeen
 z12     0          4   (Kaisaniemi, Kumpula, Harmaja, Kruunuvuorenselkä)
 z11     0          6   (+ Tapiola, Malmi)
 z10     0          9   (+ Vuosaari «ei signaalia», Itätoukki, Vantaa)
  z9     2 meri     4 meri + 5 pistettä
```

Maa-asemille **ei** lisätty ruksi-sijaintimerkkiä: `_stationDots` ei kuulu
`_obsMarkersGlobal`iin, joten `_applyMapLayers` ei piilottaisi niitä, ja
ruksit jäisivät kartalle vaikka taso käännettäisiin pois.

### Kolmas vika: HARMONIE kaatui koko funktion

Tämä löytyi vahingossa — dev-serverin loki kaatui kesken testin:

```
SyntaxError: Unexpected token 'u', "upstream c"... is not valid JSON
    at IncomingMessage.<anonymous> (api/harmonie.js:58:47)
```

`fetchOM`in `res.on('end', … JSON.parse(body))` oli ilman suojaa. Ylävirta
ei aina vastaa JSONia: välityspalvelimen aikakatkaisu palauttaa tekstin
`upstream connect error or disconnect/reset before headers`. Ja koska
heitto tapahtuu **stream-callbackin sisällä**, se ei päädy kutsujan
`try/catch`iin eikä `Promise.allSettled`iin vaan kaataa koko prosessin.

Serverittömässä ajossa se tarkoittaa 500:aa, eli `/api/harmonie` lakkaa
vastaamasta kokonaan — ja HARMONIE-lähde katoaa **kaikkialta**, myös
Helsingin yltä, ilman että mikään kertoo miksi. Nyt `JSON.parse` on
`try/catch`issa ja rejektoi selkeällä viestillä, jolloin
`_omVastaus`-varatie pääsee toimimaan niin kuin oli tarkoitus.

**Jos tähän palaa:** koko `api/`-hakemisto käytiin läpi samalla haulla.
`fmi.js` ja `kruunuvuori.js` resolvoivat raakaa tekstiä (turvallista) ja
`uiras.js` parsii `zlib.gunzip`in callbackissa, jonka virheet
rejektoidaan. Tämä oli ainoa suojaamaton jäsennys.

## Aurinkokaari siirtyi tuuliennusteen aika-akselille

Kortilla oli **kaksi eri aika-akselia**. Tuuliennuste alkaa valitusta
hetkestä ja jatkuu 24 h / 5 vrk / koko jakson; aurinkokaari kulki
keskiyöstä keskiyöhön. Ne olivat päällekkäin kortilla mutta eri
ruudukoissa, ja lukijan piti yhdistää ne päässään juuri siinä
kysymyksessä jota varten molemmat ovat: **ehdinkö vielä vesille.**

Mitattu lähtötilanne (kaari renderöitynä):

- Tilarivi `Laski 17:49` osui horisonttiviivalle ja **päällekkäin
  laskuajan `17:49` kanssa** — sama luku kahdesti, toistensa päällä.
- Oikea reuna jäi `.sh-sun-arc { margin: 0 -20px }` -bleedin takia
  kortin häivytyksen alle; sinne osunut valitun tunnin merkintä oli
  lukukelvoton.
- **9 tuntia 24:stä oli yötä**, piirrettynä horisontin alle jäävänä
  lähes näkymättömänä käyränä. Puolet leveydestä ei kantanut tietoa.
- Hämärää, kultaista tuntia, päivän pituutta tai sen muutosta ei ollut.
- Pilvisyys oli haettu (`wx.hourly.cloudcover`) mutta käyttämättä:
  graafi näytti **geometrisen valon**, ei aurinkoa.

### Kaista, ei harso

Ensimmäinen versio varjosti koko kuvaajan yön kohdalta. **Se ei
toiminut**, ja syy on kerrosten määrä: kuvaajassa oli jo kaksi
päällekkäistä taustaa — tuulen värigradientti (alfa 0,05–0,32) ja
vihreä sessioikkuna (`rgba(42,112,45,.13)`) — ja kolmas teki niistä
mutaa jossa mikään ei erottunut. Ruutukaappauksessa yö ja päivä
näyttivät samalta vihertävältä sameudelta.

Nyt valo ja pilvet ovat **omalla 6 px kaistallaan** tuntimerkintöjen
yläpuolella (`LABEL_H` 16 → 24), ja kuvaajan päälle jää vain hyvin
kevyt yöharso tunnelmaksi. Sama aika-akseli, oma kanava.

Asiat jotka eivät ole ilmeisiä:

- **Vaihe luokitellaan auringon KORKEUDESTA joka näytteessä**, ei
  nousu- ja laskuajoista. Se hoitaa monen vuorokauden jaksot ilman
  päivittäistä silmukkaa ja napa-alueet ilman erikoistapausta —
  siellä nousua tai laskua ei yksinkertaisesti ole.
- **Reunat tarkennetaan puolitushaulla näytteiden välistä.** Tunnin
  hilalla pelkkä luokittelu heittäisi auringonlaskun jopa puoli
  tuntia, ja se näkyisi suoraan siinä mihin kohtaan kaistan väri
  vaihtuu.
- **Yö ja pilvi eivät saa olla samaa sävyä.** Ensimmäisessä versiossa
  molemmat olivat `rgba(76,89,96,…)` ja pilvikaton ollessa 0,50
  täysin pilvinen päivä oli lähes yön näköinen — kaista kertoi vain
  "tummaa" eikä sitä kumpi syy oli kyseessä. Nyt yö on sinimustetta
  (`rgba(31,45,58,.74)`), pilvi neutraalia harmaata katolla 0,30.
- **Matala aurinko on lämmin** (`rgba(154,81,22,.60)`), koska se on eri
  asia kuin himmeä päivä: juuri se tunti jota illan sessiossa
  jahdataan. Raja on +6°, vakiintunut "kultaisen tunnin" määritelmä.
- **Täysi päivä jättää pohjauran näkyviin** eikä tyhjää kaistaa. Tyhjä
  lukisi "ei dataa".
- **Sade on oma 2 px kanavansa** kaistan alla: se ei muuta valon määrää
  vaan sitä kannattaako lähteä.
- **Kellonajat jäivät tekstiksi.** "Milloin laskee" luetaan sanoina,
  ei käyrän kohtana. Rivi `03:09–17:49 · 14 h 40 min · −5 min/vrk ·
  hämärä 18:35 asti` vie 14 px siinä missä kaari vei 91. Se on
  **kaavion alla**, koska se selittää juuri sen kaistan — ensin se oli
  havaintoruutujen jäljessä, missä se oli irrallaan kaikesta mihin
  liittyy.

### Aurinko-moduuli

Vanha `calcSunTime` laski nousun ja laskun keskipäivä-approksimaatiolla
ja **palautti null napa-alueilla**, jolloin koko kaistale katosi
ruudulta selittämättä. Uusi `Aurinko.korkeus()` laskee korkeuskulman
suoraan (NOAA:n yksinkertaistettu malli), jolloin samasta funktiosta
saadaan nousu, hämärän vaiheet ja kultainen tunti — ja kaavion tausta
voidaan luokitella ilman että nousuaikoja etsitään lainkaan.

Kulmat eivät ole makuasia vaan vakiintuneita määritelmiä: −0,833°
(yläreuna horisontissa, taittuminen mukana), −6° siviilihämärä, −18°
tähtitieteellinen hämärä, +6° kultainen tunti.

Tarkistettu 25 kohdan regressiolla:

```
Hanko 26.8.     nousu/lasku 03:09/17:49   pituus 880 min   −5 min/vrk
Svalbard kesä   ei laskua,  keskipäivä  35,0°   -> "Aurinko ei laske"
Svalbard talvi  ei nousua,  keskipäivä −11,8°   -> "Aurinko ei nouse"
Antarktis kesäk. keskipäivä −4,5°                (kaamos)
päiväntasaaja   727 min                          (~12 h)
```

Laskun `17:49` täsmää vanhan kaavan kanssa tasan; nousussa on 3 min ero
ja uusi on se tarkempi.

**Aikavyöhyke on selaimen**, kuten koko sovelluksessa (`AIKAVYOHYKE`):
API:lta pyydetään ajat siinä vyöhykkeessä, joten `new Date(times[i])`
on oikein. Jos spotti on eri vyöhykkeellä kuin selain, vuorokauden raja
menee selaimen mukaan — silloin nousu ja lasku voivat osua eri
vuorokausille eikä päivän pituutta näytetä lainkaan. Se on oikea
degradaatio: mieluummin ei lukua kuin negatiivinen luku. Suomen
rannikon spoteilla tilanne ei tule vastaan.

## Työpöytäselain — mitattu, ei arvattu

Sovellus on rakennettu ja mitattu kosketukselle. Windows-selaimessa se
toimi, mutta se oli puhelinsovellus venytettynä. Mittaus tehtiin
oikealla työpöytäkontekstilla — Chromium, `deviceScaleFactor 1`,
`hasTouch: false`, oikeat hiiri- ja näppäimistötapahtumat — ja lisäksi
ruutukoilla 1366×768, 1920×1080 ja 2560×1440.

### Lähtötaso

| syöte | vaikutus | havainto |
|---|---|---|
| wheel −53 px | +0,602 tasoa | kevyt kierräytys ylitti puoli tasoa |
| wheel −100 px | +1,078 | yksi Windows-napsautus yli koko tason |
| wheel −120 px | +1,264 | päätyi zoomiin 10,264 — ei koskaan tasalukuun |
| wheel −500 px | +3,323 | yksi pyöräytys ohitti kolme tasoa |
| trackpad 8 × 16 px | +1,513 | kevyt liu'utus hyppäsi 1,5 tasoa |
| tuplaklikkaus | 0,000 | ei tehnyt mitään |
| shift + veto | 9 → 11,32 | laatikkozoom toimi, mutta piilossa |
| `:hover`-sääntöjä | **0** | mikään ei reagoinut hiireen |
| pienin näkyvä teksti | 10 px | dpr 1:llä ei pikselivaraa |
| spottikortti | 1440 × 272 px | sisältöä 218 px, loput tyhjää |
| kapseli 2560 px:llä | 179 px | 7,0 % leveydestä |
| avausnäkymä | kiinteä z5 | uloin raja 2560:llä on 4,32 |

### TYOPOYTA — yksi lippu

`pointer: fine` **ja** `maxTouchPoints === 0`. Ehdon on oltava molemmat:
kosketusnäytöllinen kannettava täyttää `pointer: fine`, ja silloin
tuplaklikkaus ja kosketuksen tuplanapauta-ja-vetä taistelisivat samasta
eleestä. Sama päätös menee juuriluokkana CSS:ään, koska CSS ei näe
`maxTouchPoints`ia — pelkkä `@media (pointer: fine)` olisi väärä ehto.

### Rullazoom: kertymä, ei vähimmäisaskelta

Ensimmäinen versio pakotti jokaisen rullatapahtuman vähintään puoleen
askeleeseen, jottei kevyt kierräytys jäisi tekemättä. Trackpadilla se
vei zoomin 9:stä **13:een** — kahdeksan erillistä puolikasta askelta.
Nyt murto-osat kertyvät ja kartta liikkuu vasta kun kertymä ylittää
puolikkaan.

Nollausehto on **tila, ei aika**. Aikaikkuna (400 ms) olisi oikea luku
oikealle laitteelle mutta se ei ole mitattavissa: harnessissa
peräkkäisten `_performZoom`-kutsujen väli oli 430–678 ms, kun oikea
trackpad lähettää 10–16 ms välein. Kertymä nollataan siis silloin kun
kartan zoom on jotain muuta kuin mihin me sen viimeksi jätimme.

`zoomSnap` pysyy nollassa. Se on mitattu päätös kosketukselle (ks.
`docs/eleet.md`); rulla on diskreetti syöte, jolla murtoluku on pelkkää
epätarkkuutta, joten pyöristys tehdään vain rullapolulle ja se
kohdistuu tulokseen — jolloin rulla myös palauttaa kartan puolikkaiden
hilaan nipistyksen jäljiltä.

### Tyyppikoko: muuttujat, ei uudelleenkirjoitus

162 `font-size`-määritystä välillä 6,5–13 px. Puhelimessa dpr 3 antaa
8 px:n glyfille 24 laitepikseliä; työpöydällä dpr 1 antaa kahdeksan, ja
ohuet varret jäävät alle yhden pikselin. Koot muutettiin muuttujiksi
(169 korvausta) ja työpöydällä ne ovat noin 1,25-kertaisia. Järjestys
säilyy — yksikään kasvatettu koko ei ohita seuraavaa kiinteää — ja 14 px
ja isommat jäävät ennalleen. SVG:n esitysattribuutteihin ei kosketa,
koska `var()` ei toimi niissä.

Mitattu pienin ruudulla näkyvä koko: työpöytä 10 → 12,5 px, mobiili
10 → 10 px.

### Spottikortti: panorointi, ei kutistus

Leveydestä 1024 px alkaen kortti on oikean reunan sivupaneeli (400 px,
koko korkeus, ei verhoa kartan päällä) ja aikajana väistyy sen tieltä.
Karttaa **ei** kutisteta: kartan koon muutos vetäisi perässään
`invalidateSize`n, uloimman zoomin uudelleenlaskennan sekä lämpökartan
ja pohjakerroksen rajat. Sen sijaan kartta panoroidaan sen verran että
valittu spotti tulee vapaan alueen keskelle — sama lopputulos ilman
yhtään kokomuutosta. Panorointi tehdään vain jos spotti oikeasti jäisi
paneelin alle.

### Mittarivirhe joka olisi kaatanut koko erän

Mobiiliharness ei asettanut `hasTouch`ia. Ilman sitä
`navigator.maxTouchPoints` on 0 ja `(pointer: fine)` tosi, joten
`TYOPOYTA` meni siellä päälle: mobiilin pikselivertailu mittasi
työpöytäpolkua. Se näkyi tyyppikokoerässä 0,14 keskierona, joka
paikantui "ei signaalia" -kylttiin — se renderöityi 7,5 px:n sijaan
10 px:llä. Oikealla kosketuskontekstilla ero on 0,00.

Kaikki laitekohtainen mittaus vaatii `hasTouch`in **molempiin
suuntiin**. Ilman sitä harness ei kerro kummasta polusta on kyse.

## Aikajanan tarkkuus ja se että hetki pysyy

Kaksi vikaa, sama juuri: **aikajanan aika-akseli tulee siltä
ennustepisteeltä joka sattuu olemaan kartan keskellä**, ja se piste
vaihtuu zoomatessa.

### 1. Tarkkuus riippui zoomista

`nearestPointToCenter()` valitsee lähimmän ladatun pisteen. Lähellä
spottia se on spotti, ja spotin sarja tulee rajapinnasta tunneittain.
Kauempana se on laattapiste, ja sen sarja oli säälaattavaraston oma
akseli — mitattuna julkaistusta luettelosta **60 kertaa 3 h ja sen
jälkeen 36 kertaa 6 h** (ECMWF:n `temporal_resolution_seconds`,
97 hetkeä, 16,5 vrk). Uloszoomattuna aikajana siis harveni, ja
seitsemän vuorokauden jälkeen kuuteen tuntiin.

**Korjaus ei keksi dataa.** Kartta on koko ajan lukenut näiden askelten
välistä: `Saalaatat.asetaHetki` ottaa minkä tahansa hetken ja
`naytteista` interpoloi nopeuden ja suunnan erikseen. Aina kun aikajana
on ollut tunneittain — eli aina kun keskellä on ollut spotti — juuri
sitä interpolaatiota on katsottu. `Saalaatat.wxTunneittain()` antaa
saman myös laattapisteelle.

Mitattu sovelluksesta:

| | |
|---|---|
| varaston akseli | 97 hetkeä → tuntiakseli 397 |
| varaston omilla hetkillä | 97 pistettä, suurin ero **0 m/s** |
| välihetkillä vs kartan oma `naytteista()` | 300 pistettä, keski **0**, max **0 m/s** |

Aikajana näyttää siis täsmälleen sen mitä kartta piirtää — ei enempää
eikä vähempää. Askel on nyt 1 h joka zoomilla (z12, z9, z6, z4, uloin:
397 pistettä, 16,5 vrk, ei yhtään 3 h tai 6 h väliä).

Kaksi mitoitusasiaa jotka on pidettävä mielessä:

- **Akseli rakennetaan kerran ja jaetaan.** `_ts()`:n muisti on
  avaimitettu taulukon identiteetillä; pistekohtainen akseli mitätöisi
  sen, ja se maksoi aikanaan 337 000 `new Date()` -kutsua uloimmassa
  näkymässä.
- **Tukipisteiden joukkohaku käyttää yhä `wx()`:ää.** `loadGlobalCoarse`
  materialisoi 276 pistettä, eikä niistä katsota sarjaa vaan poimitaan
  yksi hetki. Nelinkertainen taulukko olisi siellä pelkkää muistia.

### 2. Hetki hyppäsi kun akseli vaihtui

`currentHourIdx` on **indeksi**, ja indeksin merkitys riippuu
akselista. Kun zoomaus vaihtoi keskellä olevan pisteen, indeksi 12
tarkoitti yhtäkkiä eri hetkeä: sää muuttui ilman että käyttäjä koski
aikajanaan, eikä mikään kertonut miksi.

`_tlSailytaHetki()` hakee uuden indeksin **ajasta**. Mitattuna
synteettisillä akseleilla (laatta 3 h alkaen t0, spotti 1 h alkaen
t0 + 5 h — rajapinta alkaa eri hetkestä kuin varasto):

| siirtymä | ero korjattuna | ero ilman korjausta |
|---|---|---|
| laatta 3 h → spotti 1 h (idx 10) | 0 h | **−15 h** |
| laatta 3 h → spotti 1 h (idx 30) | 0 h | **−55 h** |
| spotti 1 h → laatta 3 h (idx 40) | 0 h | **+75 h** |
| laatta 1 h → spotti 1 h (idx 40) | 0 h | **+5 h** |
| spotti 1 h → laatta 1 h (idx 40) | 0 h | **−5 h** |

Kaksi viimeistä riviä ovat se syy miksi molempia korjauksia tarvittiin:
**vaikka molemmat akselit olisivat tunneittain, ne eivät ala samasta
hetkestä.** Pelkkä tarkkuuden korjaaminen olisi jättänyt viiden tunnin
hypyn jäljelle.

Sovelluksessa mitattuna neljä reittiä (uloin↔z12, z9→z13, z13→z5):
valittu hetki **09-02 23:00 → 09-02 23:00, ero 0 h** kaikilla.

### Mitä tämä maksoi

Aikajanan DOM on uloszoomattuna 397 tikkiä entisen 97 sijaan. Pitkät
tehtävät zoomissa (4× kuristus, 5 ajoa, mediaani):

| siirtymä | 397 tikkiä | 97 tikkiä |
|---|---|---|
| z11 → uloin | 2285 ms / 34 | 2148 ms / 31 |
| uloin → z11 | 622 ms / 11 | 495 ms / 8 |
| z9 → z6 | 2291 ms / 34 | 2262 ms / 34 |

Ero on mittausmelun sisällä — raakalukujen alueet menevät joka
tapauksessa päällekkäin. Eikä 397 ole uusi suuruusluokka: spotin sarja
on ollut 384 tikkiä koko ajan aina kun keskellä on ollut spotti, eli
lähizoomissa aina.

## Minuuttitarkkuus kaatui mittaukseen — vika oli navigoinnissa

Kysymys oli pitäisikö aikajana interpoloida minuuteiksi. Vastaus on ei, ja
se selvisi mittaamalla kolme asiaa.

**1. Tuntipisteiden välissä ei ole mitään.** Tuntisarja johdetaan varaston
3 h askelista `_lerpWind`illä, joka interpoloi nopeuden lineaarisesti.
Kolmen peräkkäisen tuntipisteen keskimmäisen poikkeama naapuriensa
keskiarvosta:

| kolmikko | keskiarvo | max | n |
|---|---|---|---|
| kokonaan varastoaskelen sisällä | **0 m/s** | **0 m/s** | 10 640 |
| askelrajan yli | 0,172 m/s | 1,767 m/s | 3 395 |

Nolla ei ole "pieni" vaan eksakti: tuntipisteet ovat suoralla, ja minuutit
olisivat saman suoran pisteitä. Kolme neljäsosaa akselista ei saisi yhtään
uutta muotoa.

**2. Muutos on alle sen mikä merkitsee.** Tuulen muutos tunnissa: mediaani
0,2 m/s, p90 0,53, p99 1,07, max 2,4. Minuutissa siis 0,0033 m/s.
Sovelluksen oma kirjattu raja sille mikä merkitsee on **0,5 m/s** ("ei
muuta kalustovalintaa", ks. *Ennusteen osuvuus havaintoja vasten*) — 150×
suurempi.

**3. Näyttö ei erota niitä.** Väriramppi kvantisoi 0,1 m/s ämpäreihin.
Tunnin sisällä eri ämpäreitä on **3,5 / 60 minuuttia**, ja **94,1 %**
minuuteista renderöityisi täsmälleen kuten edellinen.

Ja hinta olisi maksettu siitä mikä aikajanassa oikeasti on vialla:

| askel | tikkejä | jana | +7 vrk raahausta |
|---|---|---|---|
| tunti | 403 | 8 866 px | **10 ruudullista** |
| 30 min | 805 | 17 710 px | 20 |
| 10 min | 2 413 | 53 086 px | **60** |

## Päiväkisko — 10 ruudullista raahausta yhdeksi napautukseksi

Mitattu navigointikitka tuntinauhassa: +1 vrk 562 px (1,4 ruudullista),
+3 vrk 1 686 px (4,3), **+7 vrk 3 934 px (10)**. Päiväerottimet ("Ke 2.")
olivat janassa mutta eivät napautettavia, ja ainoa nopea reitti eteenpäin
oli ennustepaneeli — joka vastaa kysymykseen "milloin on hyvä keli", ei
kysymykseen "vie minut lauantai-iltapäivään".

`#tl-paivat` on ohut aina näkyvä rivi päivälappuja tuntinauhan yläpuolella.
Mobiilissa 18 päivää on 883 px eli **2,3 ruudullista** (kymmenen sijaan) ja
lähipäivät näkyvät kerralla; työpöydällä (1440 px) koko kisko mahtuu
yhdelle riville, eli mihin tahansa päivään pääsee yhdellä klikkauksella.

**Napautus vie samaan kellonaikaan, ei vuorokauden alkuun.** Se on se mitä
päivien vertailu tarkoittaa: "onko lauantaina yhtä kova kuin tänään
viideltä". Vuorokauden alku olisi yön lukema jota kukaan ei katso ja
keskipäivä olisi mielivaltainen. Mitattu: 09-05 10:00 → 09-08 10:00 →
09-12 10:00, tunti säilyy joka hypyllä.

**Päivän tunniste on vuosi-kuukausi-päivä -luku eikä viikonpäivä.** Akseli
on 16,8 vrk, joten sama viikonpäivä esiintyy kahdesti ja `getDay()` osuisi
väärään.

### Mitoitus: kolme lukua yhdestä muuttujasta

`--tl-paivat-h` kasvattaa kääreen ja sen ylätäytteen yhtä paljon (jolloin
tuntinauhan oma sisältölaatikko ei muutu lainkaan) ja siirtää
indikaattoria ja aikakuplaa saman verran alas. Erillisinä lukuina ne
ajautuisivat erilleen ensimmäisessä säädössä. Kortti (`#tl-wrap::before`)
kasvaa ylöspäin ja kattaa kiskon; kupla jää sen yläpuolelle kuten ennen.

### Kosketuskohde mitattiin napauttamalla

Ensimmäinen versio oli 42×19 px pystytäytteellä, eli kiskoon jäi 13 px
läpinäkyvää. Projektin oma sääntö kertoo mitä siitä seuraa (ks.
*Kosketuskohteet ja pseudoelementtien osumapinta*): Chromiumin
kosketussäätö siirtää napautuksen lähimpään **maalattuun** kohteeseen.
Lappu täyttää nyt kiskon korkeuden.

Napautukset lapun omista suhteellisista kohdista, oikea kosketuskonteksti:
keskeltä, ylä- ja alareunasta, vasemmalta ja oikealta sekä ylävasemmalta
**osuvat**; alaoikea kulma ei. Pystypyyhkäisy 3 px lapun oikeasta
reunasta, 3 px välein:

    y+2  HUTI · y+5…y+35 osuu · y+38 HUTI

Eli kuollut kaista on **2 px kummassakin reunassa** ja käyttökelpoista on
30 px 40:stä. Se on kahden vierekkäisen kontrollin raja, ei vika: ylhäällä
on kartta ja alhaalla tuntinauha. Huti ei tee mitään tuhoisaa — napautus
menee tuntinauhaan, eli valitsee tunnin päivän sijaan.

Kisko on 40 px eikä Applen 44: se on koko kontrollin korkeus, ja 44 veisi
aikavalitsimelta neljä pikseliä lisää pystytilaa jonka se aikanaan
tarkoituksella luovutti kartalle.

**Lappujen välissä ei ole rakoa.** 3 px:n raolla napautus katosi siihen
eikä tehnyt mitään. Ilman rakoa kisko on yhtenäinen osumapinta ja napautus
osuu aina johonkin päivään; erottelun hoitaa lapun oma vaakatäyte, jolloin
tekstien väliin jää 20 px.

**Kisko ei kuuntele tuntinauhaa.** Napautus vie janan, mutta janan vieritys
vierittää kiskoa vain kun valittu päivä on jäänyt näkymän ulkopuolelle.
Ilman tuota rajausta kaksi vierityskonetta ajaisivat toisiaan takaa — sama
ansa jonka takia tuntinauhassa on `_tlBeginSelfScroll`.

## Päivänapautus vilkutti vanhaa päivää

Käyttäjän havainto: kun päivämäärää vaihtaa kiskosta, jana ei valitse
valittua päivää suoraan vaan vilkuttaa myös vanhaa ja asettuu vasta
lopulta oikeaan.

Kisko asetti valinnan oikein heti — vika oli **näytössä**. Napautus
kutsui `scrollTimelineTo`a, joka vierittää pehmeästi. Kuuden vuorokauden
hyppy on 3 168 px, ja janan omat vierityskuuntelijat päivittävät kuplan ja
päiväkorostuksen sen mukaan **missä jana kulloinkin on**. Animaatio siis
käveli jokaisen välipäivän läpi ja korostus seurasi.

Mitattuna ruututahtiin (`paallekkain.mjs`, osa B) — napautus "Pe 11.",
lähtöpäivä "Tänään":

    +   0 ms  "Tänään"
    + 174 ms  "Pe 11."      <- oikea päivä jo tässä
    + 350 ms  "Tänään"      <- takaisin lähtöpäivään
    + 4xx ms  "Su 6." "Ma 7." "Ti 8." "Ke 9." "To 10."
    +1001 ms  "Pe 11."      <- asettui

15 kirjattua välitilaa. `currentHourIdx` oli koko ajan oikea (199).

**Korjaus: hyppy on hyppy, ei vierityanimaatio.** Napautus asettaa
vierityksen suoraan `_tlSetScrollLeft`illä, joka merkitsee sen omaksi
vieritykseksi — janan kuuntelijat eivät luule sitä sormeksi — ja kutsuu
`_tlUpdateNow`ta kerran. Jälkeen kirjattuna tasan kaksi tilaa:

    +   0 ms  "Tänään"
    + 179 ms  "Pe 11."

Pehmeä vieritys on oikea silloin kun matka on lyhyt ja liike kertoo
suunnan. Kuuden vuorokauden yli se kertoo vain sen, että ohitetaan
päiviä joita ei valittu — ja koska korostus on sidottu vieritykseen,
se myös *näyttää* valitsevan niitä.

Napautuskohteet mitattiin uudelleen muutoksen jälkeen (`kiskotap.mjs`):
sama tulos kuin ennen, kuusi kohtaa seitsemästä osuu ja alaoikea kulma
on se sama 2 px:n kuollut kaista naapurikontrollia vasten.

## Aikajana: kiinteä asteikko, puuskavyöhyke, valokaista

Kolme muutosta samaan nauhaan. Yksikään ei kasvata janaa pikselilläkään
eikä hae tavuakaan verkosta — kaikki kolme käyttävät dataa joka oli jo
paikalla.

### Palkin korkeus valehteli

Korkeus skaalattiin **sarjan omaan maksimiin**, ja sarja vaihtuu joka
kerta kun karttaa siirretään: aika-akseli tulee kartan keskellä olevasta
ennustepisteestä. Mitattuna sama hetki kolmessa paikassa, ennen:

| paikka | tuuli | palkki | sarjan max |
|---|---|---|---|
| Helsinki | 7,67 m/s | 14,1 px | 12,0 |
| Pohjanlahti | 8,40 m/s | **13,4 px** | 13,8 |

Enemmän tuulta, lyhyempi palkki. Muoto oli luettavissa vain sarjan
sisällä, eikä käyttäjä tiedä milloin sarja vaihtui.

Nyt asteikko on kiinteä ja täysi korkeus on **16 m/s**. Mitattuna
jälkeen: 1,38 / 1,38 / 1,37 px per m/s kolmessa eri paikassa — sama
luku, eli sama tuuli on aina saman korkuinen.

Miksi 16 eikä rampin 20: yli kuudentoista ei foilata, joten se pää saa
kyllästyä. Sen sijaan 4–12 m/s säilyttää tarkkuutensa. Väri jatkaa siitä
mihin korkeus loppuu — ramppi kulkee punaisen kautta magentaan vielä
senkin jälkeen kun palkki on täydessä mitassaan.

### Puuska on vyöhyke, ei toinen palkki

Sama päätös ja samat sävyt kuin havaintokaaviossa (ks. *Kaavio: neljä
suuretta, yksi akseli*): kaksi kilpailevaa muotoa samalla akselilla
luetaan kahdeksi sarjaksi, vyöhyke yhdeksi asiaksi jonka **paksuus on
puuskaisuus**.

Puuskasarja on saatavilla **molemmilla poluilla** — rajapinnan
spottisarjassa ja säälaattavaraston `wxTunneittain`issa — joten vyöhyke
ei katoa uloszoomatessa. Mitattuna Helsingissä z9: vyöhyke 339 tikissä
403:sta; esimerkki tuuli 7,7 m/s → palkki 10,5 px, puuska 10,1 m/s →
vyöhyke 3,4 px sen päällä, rako palkin ja vyöhykkeen välissä 0,03 px.

Vyöhyke on neutraali liuska eikä ramppiväri: ramppiväri tarkoittaa
nopeutta, ja puuskan oma ramppiväri tekisi palkin yläosasta toisen
nopeuslukeman jota verrattaisiin alaosaan.

### Valokaista

Janassa ei ollut mitään joka kertoisi mitkä tunnit ovat pimeitä — ja
12 m/s klo 03 lokakuussa ei ole keli. `Aurinko`-moduuli oli jo olemassa
(spottikortin valokaista), toimii ilman verkkoa, ja `korkeus()` on
suljettu kaava joka ei iteroi. Sävyt ovat samat kuin havaintokaavion
yöharsossa, eli käyttäjä on nähnyt saman kielen jo spottikortissa.

Mitattuna 403 tunnin akselilla: yö 92, hämärä 65, siviilihämärä 21,
päivä 225 — ja **16 yhtenäistä yöjaksoa**, eli tasan yksi per vuorokausi.

**Tausta on tikissä itsessään**, ei erillisessä kerroksessa: vierekkäiset
yötunnit muodostavat yhtenäisen palkin ilman saumoja ja kaista vierii
janan mukana ilmaiseksi.

**Päiväerotin tarvitsi oman sävynsä.** Se on aina keskiyöllä eli keskellä
yötä, ja ilman sitä kaistaan jäi 34 px:n aukko juuri pimeimpään kohtaan.
Mitattuna 17 erotinta 18:sta saa nyt sävyn (18. on akselin alussa keskellä
päivää, oikein ilman).

**Nopea polku päivittää myös erottimet.** Ne eivät ole `_tlTicks`issä,
joten ensimmäisessä versiossa tikit vaihtoivat yön paikkaa uuden
sijainnin mukaan ja erottimet jäivät edellisen päälle — mitattuna
0/18 sävytettyä siellä missä piti olla 17. Nyt erottimet ovat omassa
taulukossaan (`_tlErottimet`) indekseineen.

### Sijainti kuuluu muistioon

`_tlMuisti`-vertailu ohittaa uudelleenrakennuksen kun lähdedata on sama.
Valokaista lasketaan **sijainnista**, ja laattapisteet jakavat
aikataulukon (`_ajatH`) — pelkkä `times`-viite ei siis erota kahta eri
paikassa olevaa laattapistettä. Muistiossa on nyt myös lat/lng.

Valovaiheet ovat muistissa avaimella (aikataulukon identiteetti, sijainti
puolen asteen tarkkuudella). Puoli astetta on noin 55 km eikä se siirrä
auringonnousua yhtä tuntitikkiä.

## Aikajana: suunta, näppäimistö ja kelihyppy

### Suunta oli datassa muttei ruudulla

`dirs` vietiin `renderTimeline`en ja talletettiin `_tlDirs`:iin — eikä
piirretty mihinkään. Mitattuna ennen: *suunnat tallessa true, piirretty
janaan false*. Se on kuitenkin se mikä ratkaisee toimiiko spotti
ylipäätään: 10 m/s väärästä suunnasta ei ole keli.

Nuoli on **joka kolmannella tunnilla**, samassa rytmissä kuin tuntilukema
— jokaisen tunnin nuoli olisi 22 px:n välein harmaa juova eikä asteikko.
Kääntö on `dir + 180` niin kuin kaikkialla muuallakin (kapseli, tähtäin,
havaintokaavio): `dir` kertoo mistä tuuli tulee, nuoli näyttää minne se
menee. Mitattuna 63 nuolta 187 tikistä, kaikki tasan joka kolmannella
tunnilla, ja 242° → `rotate(62deg)`.

**NYT-lappu törmäsi nuoleen.** Lappu on 17,5 px leveä 2 px:n merkin
päällä, eli se levittäytyy naapuritikkien päälle: mitattuna päällekkäisyys
oli 3,9 px. Sama törmäys kuin aikanaan tuntilukeman kanssa ("NYT15").
Nuoli jätetään pois merkin viereisiltä tikeiltä; niitä on korkeintaan
yksi, koska nuoli on vain joka kolmannessa. Mitattuna jälkeen: 0 osumaa.

### Näppäimistö — ja miksi ei nuolinäppäimillä

**Leaflet omistaa nuolinäppäimet.** Sen `Keyboard`-käsittelijä panoroi
karttaa nuolilla eikä tarkista shiftiä — se ohittaa vain alt/ctrl/metan,
joten Shift+nuoli panoroisi myös. Aikajanan askellus on siksi pilkulla ja
pisteellä, samassa hengessä kuin videosoittimissa. PageUp/PageDown, Home
ja välilyönti ovat vapaita: Leaflet sitoo vain nuolet, plussan, miinuksen
ja Escin.

| näppäin | teko |
|---|---|
| `,` `.` | tunti taakse/eteen, `Shift` kolme |
| `PgUp` `PgDn` | vuorokausi taakse/eteen |
| `Home` | nykyhetkeen |
| `K` | seuraava kelivikkuna |
| `Väli` | toista aika |

**Shiftattu merkki on eri `e.key`.** Suomalaisella asettelulla Shift+`.`
on `:` ja Shift+`,` on `;` (yhdysvaltalaisella `>` ja `<`), joten
`e.key === '.'` ei osunut shiftin kanssa koskaan — mitattuna Shift+`.`
ei liikuttanut valintaa lainkaan (52 → 52). `e.code` kertoo fyysisen
näppäimen ja on riippumaton asettelusta. Mitattuna korjattuna 52 → 55.

Mitattuna kaikki askeleet osuvat (+1, −1, +24, −24, Shift +3, Home =
NYT-indeksi) **eikä kartta panoroi**: keskipiste 60,0500 / 24,9500
ennen ja jälkeen.

### Kelihyppy

Päiväkisko vie päivään, mutta ei tuntiin: koko jana on 9 905 px eli
25 ruudullista. `#btn-keli` vie seuraavaan tuntiin jossa tuulta on
foilattavaksi asti **ja** aurinko on ylhäällä.

Määritelmä on sovelluksen oma eikä uusi: `foilable` on jana- ja
karttakoodissa jo `ms >= 8`, ja valokaista tietää milloin aurinko on
ylhäällä (valovaihe ≥ 2). Yläraja jätettiin pois tarkoituksella: 18 m/s
on kelivalinta, ei kelin puute, ja rajan keksiminen olisi arvaus siitä
kuka appia käyttää.

**Kohde on seuraavan JAKSON alku, ei seuraava kelvollinen tunti.**
Ensimmäinen versio palautti jälkimmäisen, ja mitattuna neljä painallusta
hyvän jakson päällä antoi `2 → 3 → 4 → 5`: nappi oli "tunti eteenpäin"
juuri silloin kun sitä painetaan, eli kun halutaan tietää milloin
seuraava on. Nyt käynnissä olevan jakson yli hypätään ensin — mitattuna
`74 → 112 → 123 → 141`.

Nappi **himmenee** kun jaksoja ei ole jäljellä, mutta ei katoa: katoava
kontrolli siirtäisi kaiken muun ja jättäisi käyttäjän ihmettelemään mihin
se meni. Mitattuna akselin lopussa himmeä = true.

**Napautus mitattiin napauttamalla.** Play-napissa oli aikanaan juuri
tämä vika: läpinäkyvä kehä hävisi viereiselle `#tl-scroll`:lle. Kelinappi
on siksi sama 44 px:n laatikko jonka ympyrä täyttää 40 px, ja
`#tl-scroll` sai saman verran täytettä oikeaan reunaan kuin vasempaan.
Mitattuna viisi kohtaa viidestä osuu nappiin.

### Yksi valintapolku kolmelle ohjaimelle

Päiväkisko, näppäimistö ja kelihyppy kulkevat kaikki `_tlValitseIdx`:n
kautta. Se sisältää sen mitä päivänapautuksen korjaus opetti: hyppy
asetetaan suoraan `_tlSetScrollLeft`illä eikä pehmeällä vierityksellä,
koska janan kuuntelijat päivittävät kuplan ja päiväkorostuksen
vierityksen mukaan. Ilman yhtä polkua sama vika olisi kirjoitettu
uudelleen kolmesti.

## Muste seuraa nyt kartan sävypolkua

Kun kartan ramppi vaihtui kylläiseksi, muste jäi vanhalle sävypolulle.
Mitattuna (`muste.mjs`) sävyero kartan ja janan välillä samalla
nopeudella:

| m/s | kartta | muste | ero |
|---|---|---|---|
| 5 | 208° | 237° | **29°** |
| 6 | 166° | 200° | **35°** |
| 18 | 358° | 24° | 26° |
| 20 | 332° | 1° | **29°** |

Kärki oli pahin: kartta päätyi magentaan, muste jäi punaiseen. Sama
nopeus oli siis kartalla ja janassa eri väri — ja juuri janan palkki on
se paikka jossa käyttäjä vertaa niitä.

**Muunnos on mekaaninen eikä makuasia.** Jokainen ankkuri laskettiin
uudelleen niin että sen **L\* ja C\* pysyvät** ja vain sävykulma otetaan
karttarampilta samalla `t`:llä. Kontrasti on kiinni L\*:ssa, joten
kontrastilupaukset säilyvät sellaisinaan:

|  | ennen | jälkeen |
|---|---|---|
| pienin kontrasti `--surface` | 4.52:1 | **4.52:1** |
| pienin kontrasti `--surface-hi` | 5.12:1 | **5.12:1** |
| L\* monotonisesti laskeva | kyllä | kyllä (44 → 13) |
| suurin sävyero karttaan | 35° | **2°** |

Yksikään ankkuri ei tarvinnut kroman laskua sRGB:n takia, eli mitään ei
menetetty muunnoksessa.

Kirkkaus kulkee edelleen **vastakkain** kartan kanssa, eikä se ole vika:
kartalla lämpökartta lisää valoa mustaan mereen, paneelissa muste lisää
tummuutta paperiin. Merkitys on sama — kovempi tuuli, enemmän kontrastia
pohjaan. Vain sävy on nyt yhteinen.

## Päiväerottimet mitattiin ja jätettiin paikalleen

Kysymys oli pitäisikö janan sisäiset päiväerottimet ("Ma 7.") poistaa nyt
kun päiväkisko kertoo päivän jo. Ne vievät leveyttä jokaisesta
vuorokaudesta. Mitattuna:

| | |
|---|---|
| erottimen leveys | 34 px |
| osuus koko janasta | **6,2 %** |
| +7 vrk raahaus nyt | 3 152 px = 8,0 ruudullista |
| sama ilman erottimia | 2 914 px = **7,4 ruudullista** |

Poisto säästäisi 0,6 ruudullista kymmenestä. Se ei ole parannus jonka
takia kannattaa menettää ainoa janan sisällä näkyvä päiväys — ja
valokaistan myötä erottimet ovat nyt osa yhtenäistä yöpalkkia, joten
poisto puhkaisisi siihen takaisin 34 px:n aukon. **Jätetään.**

## Kontrollit olivat divejä — näppäimistö ei tavoittanut niistä yhtäkään

Mitattuna ennen: sovelluksen viisi pääkontrollia (`btn-loc`,
`btn-freespot`, `fc-btn`, `btn-settings`, `btn-play`) olivat
`<div class="mctl">`, eli **0 fokusoitavaa**. Sarkain kulki kartan
jälkeen kymmenien havaintoasemamerkkien läpi eikä tavoittanut
sovelluksen omia toimintoja lainkaan. Työpöytätuki oli jo olemassa,
joten tämä koski myös hiiretöntä käyttäjää.

### Neljä muutosta, kaikki mitattuja

**1. Napit ovat `<button>`.** `.mctl` asetti jo `border: none` ja oman
taustansa, joten tagin vaihto vaati vain selaimen omien oletusten
nollauksen (`margin`, `padding`, `font-family`, `appearance`). Ulkoasu
ei muuttunut pikselilläkään.

**2. Havaintoasemat pois sarkainkierrosta** (`keyboard: false`).
Spottimerkit jäävät: spottimerkki avaa kortin eli on oikeaa sisältöä,
asemamerkki on lukema jonka saa muualtakin.

**3. Suljettu paneeli ei ole sarkainkierrossa.** Kaikki paneelit
piilotetaan siirtämällä ne ruudun ulkopuolelle (`translate`), ja ruudun
ulkopuolella oleva elementti on yhä fokusoitava ja yhä ruudunlukijan
puussa. Mitattuna sarkain kulki suljetun asetuspaneelin läpi (Valmis,
neljä kytkinriviä) ennen kuin pääsi kartan kontrolleihin. `visibility:
hidden` poistaa sen molemmista, ja siirtymä on ajoitettu niin että
näkyvyys vaihtuu vasta kun liuku on ohi — muuten paneeli katoaisi kesken
sulkeutumisanimaation.

**4. Kytkinrivi on `role="switch"`.** Rivi on ollut koko ajan se
kosketuskohde (kytkin itse on 40×24 eli alle minimin, mutta rivi on
46 px korkea), joten kokoa ei tarvinnut muuttaa — semantiikka puuttui.
`aria-checked` asetetaan myös alussa, koska tila tulee localStoragesta.

### Sarkainkierto ennen → jälkeen

    ennen   1. kartta  2.-14. havaintoasemamerkkejä …  (kontrolleja ei tavoiteta)
    nyt     1. kartta  2.-4. kapselin valitsimet  5. sijainti  6. tämän paikan tiedot
            7. parhaat ajankohdat  8. asetukset  9. play  10. kelihyppy
            11. aikajana  12. verkkotila

Näkyviä kontrolleja 24, fokusoitavia **24** (ennen: 5 pääkontrollista 0).

### Kaksi vikaa jotka löytyivät vasta mittaamalla

**Esc ei sulkenut asetuspaneelia.** Esc sulki kortin, ennusteen ja
valitsimet mutta jätti asetusladan auki — puuttui listasta. Löytyi vasta
kun paneelit tulivat sarkainkierrokseen ja mittari yritti sulkea niitä
Escillä.

**Kartan saavutettava nimi oli sen merkkien tekstiä.** Ruudunlukija luki
`#map`in nimeksi merkeistä kootun merkkijonon
("ei signaaliaei signaalia…"). Nyt `role="application"` ja
`aria-label="Tuulikartta"`.

### Mittarihuomio: pyöreän napin kulma ei ole nappi

`.mctl` on `border-radius: 50%`. Napautus laatikon kulmaan (0,12 / 0,12)
osuu ympyrän ulkopuolelle, ja mittari raportoi sen huteina — sekä ennen
että jälkeen muutoksen. Näytteet on otettava ympyrän sisältä (0,15 ja
0,85 akselia pitkin ovat säteellä 0,35). Neljä pistettä neljästä osuu
kaikkiin viiteen nappiin, ja luvut ovat identtiset ennen ja jälkeen —
eli tagin vaihto ei vienyt yhtään napautusta.

## Vähennä liikettä — aiemmin kaksi valitsinta, nyt koko sovellus

iOS:n Reduce Motion on asetus jota vestibulaarihäiriöiset tarvitsevat, ja
tämä sovellus animoi jatkuvasti liikkuvaa partikkelikenttää. Sääntö
kattoi ennen kaksi valitsinta (`.spot-ring`, `.spot-lbl`) eli käytännössä
ei mitään.

Nyt kolmella tasolla:

**CSS** nollaa siirtymät ja animaatiot koko sivulta. Kesto on 0,001 ms
eikä `none`, koska nollakestoinen siirtymä lähettää yhä
`transitionend`-tapahtuman jota jotkin polut odottavat. `transition-delay:
0s` on tässä **pakollinen**: suljetut paneelit piilotetaan
`visibility`-siirtymällä jonka viive odottaa liu'un ohi, ja ilman liukua
paneeli jäisi sarkainkierrokseen 0,38 s:ksi jokaisen sulkemisen jälkeen.

**JS** hoitaa ne kolme asiaa joita CSS ei näe: partikkelikenttä,
ohjelmalliset pehmeät vieritykset (`Liike.vieritys()`) ja Leafletin
`flyTo` (→ `setView`). `Liike.vahenna()` kysyy `matchMedia`lta joka
kerta eikä kerran käynnistyksessä — asetus voi vaihtua sovelluksen
ollessa auki.

**Käyttäjän valinta voittaa.** Asetuksen oletus on 'normaali', eikä
oletusta voi erottaa valinnasta pelkästä arvosta — siksi valinta
merkitään omaan avaimeensa (`fs_partikkelit_valittu`) kun käyttäjä koskee
siruun. Jos hän valitsee partikkelit päälle Reduce Motionin ollessa
voimassa, hän tarkoittaa sitä. Vihje kertoo miksi kenttä on tyhjä; ilman
sitä käyttäjä näkisi "Normaali" valittuna ja tyhjän kartan.

Mitattuna molempiin suuntiin (`liike.mjs`, `liike2.mjs`):

| | normaali | Reduce Motion |
|---|---|---|
| partikkeleita | 234 | **0** |
| partikkelikanvas | `visible` | `hidden` |
| kentän mustemäärä 0,7 s välein | 128 473 → 135 057 (**liikkuu**) | 0 → 0 |
| paneelin siirtymä / viive | 0,34 s / 0,34 s | 1e-06 s / **0 s** |
| lämpökartta | 15 laattaa | 15 laattaa |

Ja ketju loppuun asti: Reduce Motion päällä → 0 partikkelia ja vihje
näkyy → käyttäjä napauttaa "Normaali" → 234 partikkelia ja vihje palaa
akkutekstiin → "Pois" → 0.

**Partikkelit sammuvat, eivät jähmety.** Jäädytetty kenttä olisi yksi
ruutu satunnaisia pisteitä, ei virtauskuva — se ei kertoisi suunnasta
mitään. Suunta on saatavilla kolmesta muusta paikasta jotka eivät liiku:
kapselin lukema, spottikortti ja aikajanan suuntanuolet.

## Kosketuskohteet ja tekstikoot loppuun

### Kahvat ja valitsinrivit

Auditointi napautuskohteista löysi kolme jotka jäivät aiempien
kierrosten ulkopuolelle:

| kohde | ennen | jälkeen |
|---|---|---|
| `#sheet-handle` | 393×**26** | 393×**44** |
| `#fc-handle` | 393×**20** | 393×**44** |
| `.up-option` (yksikkö- ja suuntavalitsin) | 138×**28** | 138×**44** |

Kahvat ovat kortin ja ennustepaneelin ainoa sulkuele. Näkyvä viiva ei
muuttunut — se on `::after` ja pysyy 36×4 px:nä; lisätila on elementin
**omaa täytettä**, koska pseudoelementti ei kasvata osumapintaa
(docs/eleet.md). Ennustepaneelin kokonaiskorkeus ei kasvanut: `#fc-header`
luovutti saman 4 px:n ylätäytteestään.

Asetusten kytkimet (40×24) EIVÄT tarvinneet kokomuutosta: rivi on ollut
koko ajan kosketuskohde ja se on 46 px korkea.

**Mittarihuomio:** valitsinrivi näytti mittarissa 42,2 px:ltä. Popover on
kiinni ollessaan `scale(.96)`, ja `getBoundingClientRect` palauttaa
skaalatun koon. Avattuna mitattuna **44,0 px**. Kiinni olevan paneelin
mittaaminen antaa aina liian pienen luvun.

Listalle jäävät tarkoituksella: päivälaput (40 px, dokumentoitu päätös —
se on koko kontrollin korkeus), verkkotilan nappi (siru on kohde, nappi
on `pointer-events: none`) ja `?perf=1`-paneelin napit.

**Ilman saavutettavaa nimeä: 8 lajia → 0.**

### Aikajanan asteikko oli sovelluksen pienintä tekstiä

Tuntilukemat olivat 9 px ja päivälaput 10 px — ja juuri niitä luetaan
eniten. Applen pienin oma koko on 11 pt.

| | ennen | jälkeen |
|---|---|---|
| tuntilukema | 9 px | **11 px** |
| päivälappu | 10 px | **11 px** |
| päiväerotin | 10 px | **11 px** |
| NYT | 8 px | 9,5 px |

**Leveys ei kasvanut lainkaan.** Kaksinumeroinen luku tabular-numsilla on
11 px:llä 12,3 px leveä ja tikki on 22 px, joten se mahtuu 9,7 px:n
varalla: mitattuna 0 päällekkäisyyttä, pienin väli naapurilukemien
välillä 53,8 px (lukema on joka kolmannessa tikissä). Janan
kokonaisleveys 4 901 px ennen ja jälkeen, päiväerotin 34 px, ei
ylivuotoa.

## Tekstikoko seuraa nyt käyttäjän asetusta

Koko tyyppiasteikko oli kiinteitä pikseleitä (6,5–13 px), eli iOS:n
Dynamic Type ja selaimen oma tekstikokoasetus eivät tehneet mitään.

Koot olivat kuitenkin jo valmiiksi muuttujia (ks. *Tyyppikoko:
muuttujat, ei uudelleenkirjoitus*), joten muutos oli yksi kerroin:
`--fs-kerroin` kertoo jokaisen tokenin.

**Kerroin kahdelta lähteeltä, yhtenä lukuna:**

- **Apple:** `font: -apple-system-body` on ainoa tapa saada Dynamic Type
  verkkosivulle. Mitataan piilotetusta elementistä ja suhteutetaan
  oletukseen 17 px.
- **muut:** juurielementin laskettu `font-size`, joka heijastaa selaimen
  omaa tekstikokoasetusta. Oletus 16 px.

Tuen tunnistus on `CSS.supports('font', '-apple-system-body')`. **Ilman
sitä ei-Apple-selain lukisi shorthandin oletuskooksi 16 px ja jakaisi
seitsemällätoista, eli kutistaisi tekstin 6 % ilman että kukaan on
pyytänyt.**

**Rajaus 0,9–1,4 on tietoinen.** Dynamic Typen saavutettavuuskoot ovat
yli kolminkertaisia, eikä 22 px:n tuntitikki veny. Sen yli menevän
tarpeen hoitaa selaimen zoom, joka skaalaa myös asettelun.

Mitattuna (juurifonttia kasvattamalla, eli sitä polkua jota ei-Apple-
selain käyttää):

| juurifontti | kerroin | tuntilukema | lukeman leveys (tikki 22 px) |
|---|---|---|---|
| 16 px | 1,000 | 11 px | 12,3 px |
| 20 px | 1,250 | 13,75 px | 15,3 px |
| 24 px | **1,400** (raja) | 15,4 px | **17,1 px** |

Suurimmallakin kertoimella lukema mahtuu tikkiin 4,9 px:n varalla, eikä
yksikään mitattu elementti vuoda yli (kupla, päivälappu, tuntilukema,
kapselin osat, ennusteen otsikko, asetussirut). Päiväkisko kasvaa
1,2 → 1,5 ruudulliseen, eli se vierii kuten ennenkin.

**Aikajana rakennetaan uudelleen kertoimen muuttuessa.** Tikin leveys on
JS-vakio (`TL_TIKKI_LEV`) ja lukemat ovat CSS:ssä, joten ilman
uudelleenrakennusta keskitys osuisi vanhalla koolla laskettuun kohtaan.

Kerroin päivitetään myös `resize`- ja `visibilitychange`-tapahtumista:
järjestelmän tekstikoko voi vaihtua sovelluksen ollessa taustalla, eikä
siitä tule omaa tapahtumaansa.

## Vaakataso — 33 % kromia oli liikaa

Mitattuna 393 px korkealla vaakaruudulla aikajanan kromi oli **128 px eli
33 % ruudusta** — ja rannalla puhelin on usein juuri kyljellään.

Trimmaus osui kahteen lukuun, ei kymmeneen: `--tl-paivat-h` vetää jo
valmiiksi kolmea mittaa (kääreen korkeus, ylätäyte, indikaattorin ja
kuplan sijainti), joten sen ja kääreen kiinteän osan muutos riitti.
Juuri tätä varten se token aikanaan tehtiin.

| | pysty | vaaka ennen | vaaka nyt |
|---|---|---|---|
| kromi | 128 px (15 %) | 128 px (**33 %**) | **104 px (26 %)** |
| tunteja kerralla | 18 | 39 | 39 |
| päiväkisko | 40 px | 40 px | 30 px |
| play pohjasta | 19 px | 19 px | 19 px |

Pystynäkymä ei muutu lainkaan (raja on `max-height: 520px`, joten
tabletin vaakanäkymä jää myös ennalleen).

**Palkit pysyvät 22 px:nä.** Korkeus on kiinteällä asteikolla (16 m/s =
täysi), ja sen muuttaminen vain vaakatasossa tekisi samasta tuulesta eri
korkuisen laitetta käännettäessä — juuri se vika joka sarjakohtaisessa
asteikossa korjattiin.

Sivutuotteena vaakanäkymä on nyt se paras tapa katsoa viikkoa: koko
päiväkisko mahtuu yhdelle riville ja tuntinauhassa näkyy 39 tuntia
kerralla.

## Käynnistys vie sinne missä olit

Sovellus avautui aina koko Suomeen (`[62.5, 25.5]` z5) ellei ollut
suosikkeja tai jaettua linkkiä. Foilaaja avaa appia samalla rannalla
kerta toisensa jälkeen, joten joka avaus alkoi navigoinnilla.

### Järjestys säilyttää aiemmat päätökset

    1. jaettu linkki   — joku tarkoitti juuri sitä spottia
    2. tuore näkymä    — olit siellä äsken, jatka siitä
    3. suosikit        — pitkän aikavälin koti (dokumentoitu päätös)
    4. oletusnäkymä

**"Tuore" on 24 h.** Sitä vanhempi näkymä ei ole enää se mitä olit
tekemässä vaan viime viikon reissu, ja silloin suosikit ovat parempi
arvaus. Ilman aikarajaa muisti ohittaisi suosikit **pysyvästi**
ensimmäisen panoroinnin jälkeen — eli rikkoisi suosikkien dokumentoidun
tehtävän.

**Muisti päivittyy vasta ensimmäisen käyttäjän siirron jälkeen.** Ilman
sitä käynnistyksen oma `setView` kirjoittaisi saman arvon takaisin ja
nollaisi aikaleiman joka avauksella — jolloin 24 h ei kuluisi koskaan
umpeen ja suosikit eivät saisi vuoroaan ikinä.

Mitattuna neljä vaihetta:

| | tulos |
|---|---|
| tyhjä tila | `62.5, 25.5` z5 (oletus) |
| siirron jälkeen | `{"lat":59.99,"lng":24.4,"z":11,"ts":…}` |
| uusi avaus | `59.99, 24.4` z11 — **palautui** |
| 25 h vanha muisti | hylätään |

### Oma sijainti on asetus, ei oletus

Paikannuslupaa ei kysytä omin päin: kysely on keskeytys, ja jos käyttäjä
kieltää sen kerran, sitä ei enää kysytä. Asetuksessa on kaksi sirua
(*Viimeisin näkymä* / *Oma sijainti*), oletuksena ensimmäinen.

**Kartta ei jää odottamaan lupavastausta.** Näkymä asetetaan heti
parhaaseen arvaukseen (muistettu näkymä tai suosikit), ja sijainti korvaa
sen kun se saapuu — mutta vain jos käyttäjä ei ole sillä välin itse
siirtänyt karttaa. Jos vastausta ei tule lainkaan, ruudulla on silti
jotain järkevää.

## Aikajana kertoo nyt myös toimiiko TÄMÄ spotti

Jana näyttää nopeuden, puuskan ja valon — muttei sitä toimiiko avattu
spotti. Suunta ratkaisee sen: 10 m/s väärästä suunnasta ei ole keli.

Kun spottikortti on auki, ne tunnit joina spotti toimii saavat viivan
tikin alareunaan. Vierekkäiset tunnit sulautuvat yhdeksi viivaksi, eli
jakso lukee yhtenä ikkunana.

**Määritelmä on sovelluksen oma kolmesta kohdasta, ei uusi:**

| ehto | mistä |
|---|---|
| 6 ≤ ms < 18 | samat rajat kuin spottikortin sessioikkunassa ja `foilBadge`ssa |
| suuntaero ≤ 80° | sama raja jolla `spotIndexOsat` lakkaa antamasta suuntapisteitä |
| kesto ≥ 2 h | "alle tunnin jakso ei ole sessio vaan piikki" — kortin kaavion sääntö |

Yksi määritelmä kahdessa paikassa olisi kahden totuuden alku. Jos rajoja
muuttaa, ne muuttuvat kortissa ja janassa yhdessä.

**Merkintä on oma kanavansa**: viiva, ei väri eikä korkeus — ne ovat
varattuja nopeudelle. Sävy on sama kuin havaintokaavion sessioikkunassa
(`rgba(42,112,45,…)`), jotta sama asia näyttää samalta kortissa ja
janassa. `box-shadow: inset` eikä reunaa, jotta asettelu ja tuntilukeman
paikka eivät muutu.

Mitattuna Hanko Tulliniemellä (`bestDirs` E/S/NW): kortti auki → 94
tuntia 187:stä merkitty, **5 yhtenäistä jaksoa**, ei yhtään yhden tunnin
jaksoa (kesto­sääntö pitää); kortti kiinni → 0.

Merkintä ajetaan myös `renderTimeline`n jälkeen: tikit rakennetaan
uudelleen kartansiirroilla ja luokat katoaisivat niiden mukana.

## Kelivahti — se puolikas joka toimii ilman palvelinta

Foilaajan oikea kysymys on "milloin seuraavan kerran", ja siihen
vastattiin vain avaamalla ennustepaneeli. Vahti kertoo sen itse: jos
suosikissa on sessioikkuna seuraavan **48 tunnin** sisällä, siitä tulee
siru aikajanan yläpuolelle.

**Ei push-ilmoituksia.** Tämä on se puolikas joka toimii ilman
palvelinta, ilman lupakyselyä ja ilman taustaheräämistä — ja se on juuri
se puolikas jota katsotaan, koska appi avataan tätä varten. Push on oma
vaiheensa jos se joskus tehdään.

Ikkunan määritelmä on **sama `_sessioIkkunat`** kuin janan merkinnässä
(6–18 m/s, suuntaero ≤ 80°, kesto ≥ 2 h), mutta valoehdon kanssa: yön
ikkunaa ei ehdoteta kenellekään. Yksi funktio, kaksi käyttäjää — sama
sääntö kuin kynnysten kanssa.

**Kuittaus on ikkunakohtainen** (`spotin nimi @ ISO-alku`). Jos siru
kuitataan, sama ikkuna ei palaa — mutta seuraava tulee. Yleinen "älä
näytä enää" tekisi ominaisuudesta kertakäyttöisen.

**Kiintiövaroitus voittaa.** `#rl-banner` ja `#kelivahti` ovat samassa
kohdassa (`--sab-tl + 148px`); jos data ei päivity lainkaan, se on
tärkeämpi tieto kuin hyvä keli.

Siru puhuu käyttäjän omalla yksiköllä ja suuntamuodolla
(`Units.fmtUnit`, `Suunta.fmt`) — se ei saa puhua eri kieltä kuin kapseli
sen yläpuolella.

Mitattu ketju päästä päähän:

| | tulos |
|---|---|
| löytö | `Hanko Tulliniemi su 04–18 · 8.8 m/s 309°` |
| napautus | valittu hetki `09-06 04:00`, **ero 0 h**; kortti auki; siru piiloon |
| kuittaus | tallennettu `Hanko Tulliniemi@2026-09-06T04:00…`, sama ikkuna ei palaa |
| ei suosikkeja | siru ei näy |
| kosketuskohteet | napautusalue 321×44, sulku 44×44 |

**Mittarihuomio:** testidatassa lähimmällä suosikilla (Lauttasaari, S/SW)
ei ollut ikkunaa 48 h sisällä lainkaan — 39 tuntia 48:sta jäi alle
kuuden metrin ja loput yhdeksän tulivat luoteesta. Se ei ollut vika vaan
oikea vastaus, ja ketju mitattiin levittämällä rajaa niin että jokin
ikkuna osui haarukkaan.

## Aikajana: suunta pois, kartan värit, ja korkeus näkyviin

Kolme muutosta samaan nauhaan, ja janan ulkomitat ovat **täsmälleen
samat kuin ennen** (128 px).

### 1. Suuntanuolet pois

Ne veivät oman rivinsä nauhan yläreunasta eikä niitä tarvittu. Se rivi
on nyt tuntilukemien, ja juuri se vapautti korkeuden palkeille.

### 2. Palkit ovat kartan värisiä — ja siksi tarvittiin tumma ura

Karttaramppi on suunniteltu tummalle merelle, eikä se toimi paperilla.
Mitattuna kontrasti kortin pintaan:

| m/s | karttaväri | kontrasti paperiin |
|---|---|---|
| 4 | `0,175,250` | 2,00 |
| 8 | `60,235,45` | 1,30 |
| **10** | `205,240,0` | **1,06** |
| 16 | `255,50,50` | 2,96 |

Yhdeksän yhdestätoista jää alle 3:1 ja 10 m/s on käytännössä näkymätön.
**Väriä ei siis voi matchata karttaan vaihtamalla funktiota — alustan on
vaihduttava.**

Tuntinauha sai oman uran (`--tl-ura`, `#16222A`), samaa mustetta kuin
aikakupla ja päivälappu eli sovelluksen oma *tumma pilleri = mitattu
data* -pinta. Samalla uralla karttavärit saavat kontrastin **3,2–12,4**
kahdesta metristä ylöspäin.

Ura on omana kerroksenaan (`#tl-wrap::after`) scrollin takana eikä
scrollin taustana: taustana se olisi täysleveä musta palkki paperin
poikki, upotettuna se on ura kortin sisällä.

**Nollapää tarvitsi kehyksen.** 0 m/s on syvä yösininen ja sen kontrasti
uraan on 1,14 — lyhyt palkki katoaisi. Palkilla on siksi ohut vaalea
sisäkehys, joka ei näy kirkkailla väreillä.

**Palkki EI seuraa `karttaRamppi()`:a.** Vaalealla pohjakartalla se
palauttaa musteen, ja muste on tehty paperille: mitattuna sen kontrasti
uraan on **1,00–2,90**, eli koko asteikko olisi näkymätön. Palkit
käyttävät `ColorRamp.tumma()`:a, joka on aina kylläinen ramppi — tai
värisokeusramppi jos käyttäjä on sen valinnut, koska se valinta koskee
näköä eikä alustaa.

| pohjakartta | palkin 8 m/s | kartan 8 m/s | kontrasti uraan |
|---|---|---|---|
| tumma | `60,235,45` | `60,235,45` | 10,12 |
| satelliitti | `60,235,45` | `60,235,45` | 10,12 |
| vaalea | `60,235,45` | `55,84,47` (muste) | 10,12 |

Eli vaalealla pohjalla jana ja kartta eroavat tarkoituksella — se on
ainoa tapa jolla molemmat pysyvät luettavina.

> **Tämä osio kuvaa mennyttä tilaa.** Tumma ura on korvattu hiekkauralla
> ja `ColorRamp.tumma()` funktiolla `ColorRamp.paperi()`. Päätelmä
> "alustan on vaihduttava" oli oikea vain yhdellä oletuksella — että
> palkin kirkkaus on koskematon. Ks. *Aikajanan ura vaihtui hiekkaan*.

### 3. Korkeus näkyviin ilman että jana kasvaa

Viisi vaihtoehtoa punnittiin:

| | vaihtoehto | tulos |
|---|---|---|
| 1 | kasvata janaa pystysuunnassa | hylätty — nauha luovutti pystytilan kartalle tarkoituksella |
| 2 | **lukema palkkien yläpuolelle** | vapauttaa 15 px, palkki 22 → **35 px** |
| 3 | **epälineaarinen asteikko** | 4–14 m/s levennetty |
| 4 | nollan siirto (asteikko alkaa 2 m/s) | +14 % ja valehtelee nollasta |
| 5 | meteogrammikäyrä palkkien tilalle | **kaadettu jo mittauksella** — litistyy nauhan korkeudella |

Tehtiin 2 ja 3 yhdessä. Ne eivät kilpaile: ensimmäinen antaa pikseleitä,
toinen jakaa ne sinne missä niitä tarvitaan.

Käyrä ja mitattu tarkkuus:

```
     0- 4 m/s -> 0,00-0,15    1,13 px / (m/s)   tyven, harvoin luettu
     4- 8     -> 0,15-0,50    3,06 px           sessioraja
     8-12     -> 0,50-0,80    2,63 px           paras keli
    12-16     -> 0,80-1,00    1,75 px
       > 16   -> 1,00         kyllästyy, väri jatkaa
```

Ennen koko asteikko oli **1,38 px / (m/s)**. Sessiovälillä tarkkuus on
nyt **2,2-kertainen** ja parhaan kelin välillä **1,9-kertainen** — ja
jana on yhtä korkea kuin ennen.

**Korkeus on MUOTO ja väri on ARVO.** Se on työnjako eikä puute: ramppi
on kvantisoitu 0,1 m/s välein ja yhteinen kartan kanssa, joten tarkka
lukema luetaan sävystä ja kuplasta — korkeus kertoo nousun ja laskun.
Ilman tätä jakoa toinen niistä olisi aina huono.

### Uralle sopeutettu, ja mitä se maksoi

Kaikki nauhan sisällä oleva kääntyi: yökaista on nyt mustaa valon sijaan
(`rgba(0,0,0,.34/.22/.11)`), puuskavyöhyke on valoa musteen sijaan,
päiväerottimet ja NYT-merkki ovat vaaleita. Tuntilukema siirtyi
yläreunaan ja on siellä samalla rivillä NYT-lapun kanssa — sama törmäys
kuin aikanaan ("NYT15"), sama ratkaisu: lukema jätetään pois merkin
viereisiltä tikeiltä. Mitattuna 0 osumaa.

### Virhe joka jäi kiinni vasta selaimessa

`nytVieressa` esiteltiin `const`illa vasta sen käytön jälkeen —
temporaalinen kuollut vyöhyke, eli `ReferenceError` heti ensimmäisellä
tikillä ja koko sovellus jäi käynnistymättä. **Syntaksitarkistus meni
läpi**, koska virhe on ajonaikainen. Juuri tätä varten sääntö sanoo että
sivu on ladattava selaimessa.

## Puuskahuntu ja uran reuna — kaksi korjausta mittauksen jälkeen

### Puuska vei liikaa tilaa

Täytetty vyöhyke kasvoi uuden asteikon mukana. Mitattuna:

| | ennen |
|---|---|
| näkyi | **85 %** tunneista |
| korkeus mediaani | 7,4 px |
| korkeus **max** | **25,1 px = 71 % koko palkkiasteikosta** |

Se ei ollut enää merkintä vaan toinen palkki.

**Kynnyksen nosto ei olisi auttanut.** Puuska/tuuli-suhteen mediaani on
mitattuna **1,41**, eli Itämerellä lähes jokainen tunti on puuskainen:
sovelluksen oma raja (suhde > 1,4, `spotIndexOsat`in rangaistuskynnys)
olisi jättänyt vielä 51 % tunneista. Esitystavan oli kevennyttävä, ei
otoksen.

Nyt puuska on **ylöspäin häviävä huntu** ilman reunaviivaa, ja se alkaa
palkin sisältä pikselin verran — muuten väliin jää sauma, ja juuri sauma
tekee siitä erillisen esineen palkin pehmeän yläpään sijaan.

| | ennen | nyt |
|---|---|---|
| korkeus max | 25,1 px | **10,0 px** |
| osuus palkkiasteikosta | 71 % | **29 %** |
| reunaviiva | 1,5 px kirkas | ei ole |

**Katto siirsi tiedon toiseen kanavaan.** Kun korkeus katkaistaan
kymmeneen, se sitoo useimmat hunnut (mediaani 8,6 px) eikä enää erottele
*kuinka* puuskaista on. Se tieto on nyt läpinäkyvyydessä, joka ei vie
tilaa lainkaan: suhde 1,15 (tuskin havaittava) → alfa 0,40, suhde 1,8
(mitattu p90) → alfa 1,00. Mitattuna alfan jakauma on 0,40 / 0,67 / 1,00.

### Uran ja paperin raja oli kova

Mitattuna ensimmäinen ura oli **13,1:1** kortin paperia vasten — kova
askelma kahden pinnan välillä. Kolme muutosta, kaikki mitattuja:

1. **Liuku tasaisen mustan tilalle.** Ylhäällä vaaleampi, alaspäin
   syvenevä: silmä saa rampin eikä askelmaa, ja ura lukee upotetulta
   eikä päälle liimatulta.
2. **Lämmin sävy viileän liuskeen tilalle** (`#35434A` → `#212B31`).
   Kortti on lämmintä kermaa, ja viileä sini-harmaa sen vieressä lukee
   vieraana. Vaihtoehdot mitattiin:

   | ura | reuna paperiin | palkit uraan |
   |---|---|---|
   | ensimmäinen `#26363F` | 10,1:1 | 1,2–12,9 |
   | **valittu `#35434A`** | **8,3:1** | 2,8–11,0 |
   | kevyempi `#3E525E` | 6,6:1 | 2,4–9,4 |

3. **Pehmeä varjo paperin puolelle** ja paperinvärinen sisäreuna:
   raja on kortin oma eikä musta viiva.

**Ruudulta mitattuna** (pikselit, ei tokenit) reunakontrasti on nyt
**7,9:1** — ensimmäinen versio 13,1:1.

---

## Aikajanan ura vaihtui hiekkaan

Uraa oli hiottu kahdesti (13,1:1 → 8,3:1 lämpimällä sävyllä ja liu'ulla)
ja käyttäjä sanoi silti saman asian: kortin musta ja beige riitelevät.
Se ei ollut makuasia vaan mitattava luku — **ruudun pikseleistä paperin
ja uran ero oli 8,97:1**, eli kortin kovin kontrasti oli sen tyhjä
alusta, ei yksikään datapiste.

### Viisi strategiaa, kaikki oikeassa sovelluksessa

Vaihtoehdot rakennettiin `?jana=1..5` -kytkimen taakse ja kuvattiin
samasta datasta ja samasta kohdasta, koska tämä on valinta jota ei voi
tehdä sanoista.

| | strategia | paperi→alusta | palkki alustaa vasten (himmeä / kirkas) |
|---|---|---|---|
| 0 | tumma ura (lähtötila) | 8,97 | 1,79 / 5,84 |
| 1 | ei uraa lainkaan | 1,07 | 1,81 / 4,57 |
| **2** | **vaalea hiekkaura** | **1,13** | **1,83 / 4,20** |
| 3 | koko kortti tumma | 1,07 | 2,06 / 6,93 |
| 4 | häivytetty ura | 1,68 | 1,31 / 2,61 |
| 5 | ei alustaa, ääriviiva palkissa | 1,00 | 1,22 / 1,45 |

4 ja 5 kaatuivat mittaukseen: häivytetyllä uralla ylimmät palkit jäävät
2,61:een eli hiljainen tuuli hukkuu juuri sinne mistä se luetaan, ja
pelkkä ääriviiva paperilla antaa 1,45 — sama tulos kuin aikanaan
karttarampilla paperilla (10 m/s 1,06:1). Käyttäjä valitsi 2:n.

**Mittari valehteli kahdesti matkalla.** `#tl-wrap`in yläkulma on
karttaa eikä paperia, joten ensimmäinen ajo vertasi vihreää merta
magentaan; ja magentaosoittimen kohdalla molemmat näytteet osuvat
osoittimeen, mikä antoi tasan saman minimin (1,15) kaikissa kuudessa
variantissa. Kun luku on identtinen asetuksesta riippumatta, se on
mittarin oma.

### Ratkaisu oli palkin kirkkaudessa, ei alustassa

Vanha päätelmä *"väriä ei voi matchata karttaan vaihtamalla funktiota —
alustan on vaihduttava"* piti paikkansa vain yhdellä oletuksella: että
palkki on kartan väri **sellaisenaan**. Kolmas tie on kertoa kartan
ramppi vakiolla — sRGB-kertominen säilyttää sävyn ja laskee kirkkautta,
eli juuri se ominaisuus joka palkin ja kartan yhdistää jää koskematta.

`ColorRamp.paperi()` = karttaramppi × 0,48. Kerroin on mitattu:

| kerroin | kontrasti uraan min / med | pienin dE2000 (2 m/s väli) | C* keski |
|---|---|---|---|
| 1,00 | 1,02 / 1,62 | 12,5 | 79,8 |
| 0,52 | 2,97 / 4,83 | 11,1 | 48,0 |
| **0,48** | **3,41 / 5,42** | **10,7** | **45,0** |
| 0,44 | 3,87 / 6,00 | 10,3 | 42,1 |

Prototyypissä kerroin oli 0,52, mutta se jättää limetin (10 m/s) uran
pohjaa vasten 2,97:ään. 0,48 nostaa koko asteikon yli kolmen ilman että
ero kuvaan näkyy.

| m/s | kartta | palkki | kontrasti uran suuhun / pohjaan |
|---|---|---|---|
| 2 | `0,100,245` | `0,48,118` | 9,12 / 8,04 |
| 8 | `60,235,45` | `29,113,22` | 4,48 / 3,95 |
| 10 | `205,240,0` | `98,115,0` | 3,87 / 3,41 |
| 16 | `255,50,50` | `122,24,24` | 7,79 / 6,87 |

Taulu ei seuraa pohjakarttaa — mitattuna 8 m/s on `29,113,22` tummalla,
vaalealla ja satelliitilla — mutta seuraa värisokeusasetusta
(cvd: `40,87,94`, eli kartan `84,182,196` × 0,48).

### Käänteinen keino kaikelle mikä oli uran päällä

Ura vaihtoi materiaalia, joten kaikki sen päällä oleva vaihtoi suuntaa.
Alfoja ei voinut kopioida sellaisenaan: sama luku antaa hiekalla eri
vaikutuksen kuin musteella.

| merkintä | tumma ura | hiekkaura | ero uraan molemmissa |
|---|---|---|---|
| puuskahuntu | valkoinen .22 | muste **.34** | 2,0:1 |
| yökaista | musta .34 | `76,89,96` **.24** | 1,35:1 |
| tuntilukema | valkoinen .78 | `--ink-2` | 4,2 → 5,2:1 |
| NYT ja päiväerotin | valkoinen .62 | `--ink-3` | 4,2 → 4,1:1 |
| palkin sisäkehys | valkoinen .16 | muste .16 | — |

Ensimmäinen yritys käytti huntuun alfaa .26 ja yökaistaan .20, ja
molemmat haalistuivat: huntu jäi 1,4:1 eli se olisi kadonnut hiljaa
mukana. Kolmas rivi on hunnun kohdalla se joka ei ollut ilmeinen —
**huntu piirtyy palkin YLÄPUOLELLE eli uran pintaan, ei palkin päälle**,
joten sen sävy seuraa uraa eikä palkkia.

Uran oma varjo kääntyi myös: ulkovarjo oli tumman uran tarve (se sitoi
mustan laatan paperiin), ja kahden lähes samanvärisen paperin välissä se
olisi ollut ainoa jäljelle jäävä kova reuna eli juuri se mikä
poistettiin. Nyt syvyyden tekee upotusvarjo ylhäällä ja valoviiva
alhaalla.

**Lopputulos ruudulta mitattuna:** paperi→ura **8,97 → 1,05:1**, palkit
uraa vasten 4,50 (mediaani) ja 4,69 (kirkkain), menneet tunnit 1,83
kuten ennenkin.

### Sivulöydös: värisokeusramppi ei päivittänyt aikajanaa

`KarttaAsetukset.kayta('ramppi')` ohitti aikajanan tarkoituksella, ja
kommentti perusteli sen: *"Paneelien musteramppi (ColorRamp.ink) ei
muutu."* Se piti paikkansa siihen asti kun palkit olivat mustetta.
Palkkien vaihduttua karttaramppiin (ensin `tumma()`, nyt `paperi()`)
perustelu jäi voimaan vaikka ehto oli kadonnut, ja palkit jäivät vanhaan
ramppiin seuraavaan kartansiirtoon asti. Nyt `kayta` päivittää palkit
`_tlMuisti`sta. Mitattu: `29,113,22` → `40,87,94` → `29,113,22` ilman
kartansiirtoa.

---

## Kontrollit pois datan päältä, kisko kertomaan säästä

Kaksi vikaa jotka näkyivät vasta kun ura oli korjattu.

### Napit olivat siellä missä data on

> **Tämä siirto peruttiin.** Napit ovat takaisin uran päällä Windyn
> tapaan; mittaukset alla pätevät yhä, mutta johtopäätös vaihtui. Ks.
> *Napit takaisin uran päälle — kohotus kontrastin tilalle*.

Play ja kelihyppy kelluivat uran vasemmassa ja oikeassa reunassa. Mitattuna
ne peittivät **mobiilissa 6 näkyvää tuntia 17:stä eli 35 %** datasta.
Työpöydällä sama luku on 6 %, joten tämä oli mobiilin vika eikä designin.
Samalla ne olivat itse lähes näkymättömiä: paperikiekko paperilla on
**1,07:1**, eli ne erottuivat vain varjostaan.

Molemmat siirtyivät päiväkiskon riville oikeaan päähän. Uran peitto on nyt
**0 %** molemmilla laitteilla, ja hinta on kiskon leveys: 377 → 281 px,
näkyviä lappuja 8 → 6. Se on halpa hinta, koska kisko rullaa ja ura ei.

> **Mittari valehteli tässäkin.** Peittomittari vertasi vain vaakasuuntaa,
> ja siirron jälkeen se väitti yhä 29 %:n peittoa vaikka napit eivät ole
> enää samalla rivillä lainkaan. Pystysuunta oli lisättävä ehtoon. Vanha
> 35 %:n luku pitää silti paikkansa: silloin napit OLIVAT samalla rivillä,
> jolloin vaakapeitto oli koko totuus.

Kiekko sai kehän (`--hairline`), koska paperilla se on samaa materiaalia
kuin kortti. Kontrolli lukee kuvakkeestaan: **12,4:1** play ja **10,7:1**
kelihyppy kiekkoa vasten, kun kiekko itse on kortista 1,11–1,19:1.
Soidessa kiekko on `--accent`, ja se on nyt vahva merkintä eikä hukkuva.

Napautukset mitattiin uudelleen, koska naapuriksi tuli vaakaan vierittyvä
kisko — juuri se tilanne jossa Chromiumin kosketussäätö vei aikanaan
napautuksen vierittimelle. **8/8 molemmilla**, näytteet ympyrän sisältä.

> Kelihypyn ensimmäinen ajo antoi 5/8. Kolme "hutia" olivat akselin
> lopussa (178/181): nappi oli tyhjä eikä sillä ollut minne hypätä.
> Mittari kulutti akselin itse. Lähtötilan palautus jokaisen näytteen
> väliin antoi 8/8.

`#tl-scroll`:n 54 px:n reunatäyte poistui samalla. Se oli olemassa vain
suojaamassa akselin päitä napeilta. Näkyvien tuntien määrä ei muutu
kumpaankaan suuntaan — 17 mahtuu 393 px:ään joka tapauksessa — mutta
yksikään niistä ei ole enää minkään alla.

Play sai `role="button"` ja `tabindex`in kelihypyn tapaan; Välilyönti hoiti
toiminnon jo ennestään, joten fokuspysäkki on myös käytettävä. Sarkaimen
ulkopuolelle jäävät yhä `btn-loc`, `btn-freespot`, `fc-btn` ja
`btn-settings` — sama vanha puute, ei tämän muutoksen.

### Kisko vei 31 % kortista eikä sanonut säästä mitään

Kysymys "mikä päivä kannattaa" vaati 12 ruudullista raahausta
tuntinauhassa. Nyt jokaisella päivälapulla on **tuulikaista**: sen päivän
kovin tuuli.

**Leveys on muoto, väri on arvo** — sama kielioppi kuin tuntipalkilla, ja
samasta syystä. Pelkkä väri ei kelpaa: rampin hiljainen pää on paperilla
TUMMIN (0 m/s on `6,14,58`), joten tyyni päivä näyttäisi kolmen pikselin
kaistana kaikkein raskaimmalta. Leveys kääntää sen oikein päin.

Kaista on pillerin **ulkopuolella**, ei sisällä. Sisällä se osuisi valitun
päivän kohdalla mustan päälle, jossa ramppi ei toimi (0 m/s musteella on
1,3:1). Ulkopuolella alusta on aina samaa hiekkaa. Siksi pilleri on nyt
`::before` eikä lapun oma tausta, ja lappu itse on yhä täyskorkea —
napautuspinta ei muuttunut, vain maali. Mitattu napautuksin: **7/7**
kohtaa osuu, myös kaistan kohdalta.

**Luku on valoisan ajan huippu, ei vuorokauden.** Mitattuna ne eroavat
viitenä päivänä yhdeksästä, keskimäärin 0,44–1,33 m/s ja vähintään
1,5 m/s yhtenä–kahtena päivänä yhdeksästä. Ero on pieni, mutta se tapaus
jonka se korjaa on väärä lupaus: yöllä puhaltava huippu ei ole keli.
Akselin ensimmäisellä ja viimeisellä päivällä valoisia tunteja voi olla
nolla (mitattu), ja silloin käytetään koko välin huippua — muuten vajaa
päivä näyttäisi tyyneltä.

| päivä | tunteja | valoisia | vrk-huippu | kaistalla |
|---|---|---|---|---|
| Pe 4. | 6 | 0 | 1,2 | 1,2 *(varatie)* |
| La 5. | 24 | 14 | 3,8 | 3,1 |
| To 10. | 24 | 13 | 3,6 | **2,0** |

**Kaista päivitetään MYÖS nopeassa polussa.** Kisko rakennetaan vain
hitaassa, koska se riippuu aikaleimoista — mutta kaista riippuu
nopeuksista, ja nopea polku on juuri se joka ajetaan kun aika pysyy ja
paikka vaihtuu. Sama ansa kuin päiväerottimien valovaiheessa aikanaan.
Mitattu: kartansiirron jälkeen kaistat vaihtuivat ja vastasivat uutta
dataa 9/9.

Lapun aria-nimi kertoo luvun, koska kaista on väriä eikä ruudunlukija näe
sitä: *"Pe 4., kovin tuuli 1,2 m/s"*.

Kortin korkeus ei muuttunut: 128 px ennen ja jälkeen.

---

## Napit takaisin uran päälle — kohotus kontrastin tilalle

Siirto kiskoriville ratkaisi mitatun ongelman mutta rikkoi sen mitä
kontrolli tarkoittaa: transportti kuuluu sen raidan päälle jota se ajaa.
Napit palautettiin uralle Windyn tapaan, ja niiden mukana palasi
`#tl-scroll`:n 54 px:n reunatäyte, joka suojaa akselin ensimmäisen ja
viimeisen tunnin napin alta janan päissä.

**Peiton hinta maksetaan tietoisesti.** Mobiilissa napit peittävät jälleen
6 näkyvää tuntia 17:stä eli 35 % (työpöydällä 8 %). Se on kelluvan
kontrollin hinta, ei vika jota ei olisi huomattu.

**Näkyvyys ratkaistiin toisin kuin ensin.** Hiekkauralla paperikiekko oli
1,07:1 alustaansa vasten. Sitä ei korjattu tummentamalla nappia — se
tekisi kontrollista kortin äänekkäimmän elementin datan päällä. Korjaus
on kohotus:

| | ennen | nyt |
|---|---|---|
| kiekko alustaansa vasten, play | 1,07:1 | **1,56:1** |
| kiekko alustaansa vasten, kelihyppy | 1,19:1 | **1,39:1** |
| kuvake kiekkoa vasten | 12,4 / 10,7 | **16,4 / 13,6** |

Kiekko on kortin pintaa vaaleampi (`--surface-hi`), sillä on lämmin
kehä ja pehmeä varjo. Silmä lukee sen kelluvana esineenä uran yllä eikä
väriläikkänä urassa — sama keino kuin uran omassa upotuksessa, toiseen
suuntaan. Napautukset mitattiin uudelleen uudessa paikassa: **8/8
molemmilla**.

### Neljä viimeistelyä samalla

1. **Kiekko keskitettiin uraan pystysuunnassa.** Se roikkui 3 px uran
   alareunan ali. Kelluva esine keskittyy siihen mitä se peittää.
2. **Painallus näkyy.** Kiekko painuu `scale(.92)`, ei koko laatikko:
   laatikko on osumapinta eikä saa liikkua sormen alta.
   `prefers-reduced-motion` poistaa siirtymän, ei tilaa.
3. **"Ei kelivikkunaa" on kohotuksen poisto, ei läpinäkyvyyttä.**
   `opacity: .35` haalisti myös varjon ja kehän, jolloin kiekko näytti
   puoliksi piirretyltä. Nyt kiekko laskeutuu uran tasoon ja kuvake
   vaalenee: sama esine, ei nostetta.
4. **Fokusrengas seuraa muotoa.** Globaali `:focus-visible` asetti
   `border-radius: 4px`, mikä piirsi jokaisen pyöreän `.mctl`-napin
   ympärille pyöristetyn neliön. Nyt rengas on ympyrä.

### Kupla: kaksi asiaa, kaksi painoa

Kupla luki *"Su 20:00"* yhdellä painolla, eli viikonpäivä ja kellonaika
olivat samanarvoisia. Ne eivät ole: päivän kertoo jo päiväkisko
korostetulla pillerillään, ja kupla on olemassa TUNTIA varten — se on
ainoa paikka jossa valittu tunti lukee numeroina. Viikonpäivä jää
kuplaan erottamaan viisi vuorokautta toisistaan, mutta se on kontekstia
eikä lukema: sama rivi, sama korkeus, kevyempi paino ja 0,62 alfa.

---

## Päiväkisko sai saman uran kuin tuntinauha

Kortin sisällä oli kaksi eri materiaalia: tuntinauha upotetussa
hiekkaurassa ja päiväkisko paljaalla paperilla. Ne ovat saman asian kaksi
tarkkuutta — sama akseli, eri askel — eivätkä siis kaksi eri lajia. Nyt
molemmat ovat samassa urassa: samat tokenit, sama pyöristys, sama
upotusvarjo ja valoviiva. Kortti on paperia, ja paperiin on uurrettu
kaksi rinnakkaista raitaa.

Mitattuna ruudun pikseleistä:

| | päiväraita | tuntiraita |
|---|---|---|
| vaakasijainti | 14–379 px | 14–379 px |
| kortti → ura | 1,16:1 | 1,15:1 |
| uran suu | `216,205,177` | `216,206,178` |
| sisällön teksti uraa vasten | 4,57:1 | 4,61:1 |

Raitojen keskinäinen ero on **1,01:1** eli sama materiaali, ja niiden
väliin jää 9 px paperia.

### Kolme mitoitusta piti sovittaa uudelleen

1. **Raitojen väli.** `#tl-wrap`in täyte oli 14 px ylhäällä ja 22 px
   alhaalla, jolloin raitojen väliin jäi 3 px ja uran alle 14 px tyhjää
   korttia. Kolme pikseliä luki saumana kahden pinnan välissä. Väli
   jaettiin uudelleen 20 / 16, jolloin raitojen väliin tulee 9 px ja
   kortin alareunaan 8 px. Summa on sama, joten uran korkeus (52 px) ja
   koko kortin korkeus (128 px) eivät muutu. Osoitin ja napit siirtyivät
   saman verran; napin keskipiste on mitattuna täsmälleen uran keskellä.
2. **Pilleri ja tuulikaista olivat uran reunojen PÄÄLLÄ.** Pilleri alkoi
   lapun ylälaidasta ja kaista päättyi sen alalaitaan, eli täsmälleen
   uran reunoihin: pilleri näytti puhkeavan raidasta ja kaista irtosi
   omaksi rivikseen raidan alle. Neljä pikseliä molempiin päihin sitoo
   ne uraan. Lappu on yhä 44 × 40 px, eli napautuspinta ei muuttunut —
   mitattu napautuksin 7/7.
3. **Lapun muste.** Lappu ei ole enää paperilla vaan uralla, ja
   `--ink-3` on hiekalla 4,05:1 eli alle pienen tekstin rajan.
   `--ink-2` on 5,2:1 ja se on sama sävy jolla tunnit lukevat omassa
   urassaan — sama alusta, sama muste.

### Ura on oma kerroksensa, ei kiskon tausta

Sama syy kuin tuntinauhalla mutta terävämpi: `#tl-paivat`illa on
reunahäivytysmaski, ja taustana ura häipyisi päistään sen mukana.
Tuntiuran päät eivät häivy, joten raidat eivät enää vastaisi toisiaan.
Maski kuuluu sisällölle, ei alustalle.

> **Mittari valehteli kolmannen kerran.** Ensimmäinen ajo väitti, että
> samoilla tokeneilla piirretyt raidat ovat eri värisiä (`225,214,184`
> vs `201,194,170`). Näytteet oli otettu raitojen keskeltä, jossa ne
> osuivat palkkiin, yökaistaan ja napin varjoon. Paljas ura löytyy vain
> sieltä missä sisältö on häivytetty — ja siellä on osattava pysyä
> pyöristyksen sisäpuolella, tai näyte on kortin ulkopuolelta.

---

## Urat pois — yksi paperi, kaksi riviä

Aikajanalla oli tässä vaiheessa kaksi upotettua uraa, ja ne olivat
mitattuna identtiset (1,01:1 raidasta raitaan). Juuri se teki niistä
turhat: kaksi pyöristettyä laatikkoa kortin sisällä on kolme reunaa
liikaa, kun kortin oma reuna kertoo jo missä aikajana on. Samalla
poistettiin päivälappujen tuulikaistat.

Kortti on nyt yhtä paperia reunasta reunaan. Rakenteen tekee tyhjä tila:
päivärivi, 9 px, tuntirivi.

### Sisältö ei hävinnyt urien mukana — se parani

Kortin paperi (mitattu `228,219,197`) on VAALEAMPI kuin ura oli, joten
tummat palkit saavat sitä vasten enemmän kontrastia:

| m/s | palkki | kortilla | uran suu | uran pohja |
|---|---|---|---|---|
| 8 | `29,113,22` | **4,45** | 4,48 | 3,95 |
| **10** | `98,115,0` | **3,84** | 3,87 | **3,41** |
| 12 | `121,95,0` | **4,42** | 4,45 | 3,93 |

Heikoin nopeus koko asteikolla nousi **3,41 → 3,84**. Kortin sisäinen
reuna, joka oli tämän koko sarjan lähtökohta (8,97:1 tummalla uralla,
1,05:1 hiekalla), on nyt **1,00:1** — sitä ei ole.

### Kaksi asiaa piti virittää uudelleen

1. **Yökaista.** Se on ollut kolmella eri alustalla ja sen VOIMAKKUUS on
   pidetty samana joka kerta: musta .34 tummalla uralla 1,35:1,
   `76,89,96` .24 hiekkauralla 1,35:1 — ja kortin paperilla sama .24
   olisi antanut **1,40:1**, eli uran poisto olisi vahingossa tehnyt
   yöstä äänekkäämmän. `.20/.129/.060` palauttaa **1,32:1**. Kaista on
   nyt tuntirivin ainoa suuri muoto, joten sen voimakkuus ei ole
   makuasia.
2. **Napit.** Kiekko luki uran päällä 1,56:1, koska ura oli sitä
   tummempi. Kortin paperilla `--surface-hi` on 1,27:1 eli lähes sama
   pinta, joten kohotus on tehtävä varjolla: tiukka 1 px irrottaa
   reunan, pehmeä 5 px antaa korkeuden, ja kehä nousi .22 → .28.
   Kuvake kantaa tunnistuksen kuten ennenkin (16,4:1 ja 13,7:1).

> Varjon voimakkuutta ei voi mitata tästä napista pikseleinä: nappi
> kelluu datan päällä, joten sen ympärillä ei ole paljasta korttia vaan
> palkkeja. Ensimmäinen yritys antoi "varjo/kortti 3,23" — se oli
> palkki, ei varjo.

### Tuulikaista päivälapuista pois

Kaista toimi ja se oli mitattu oikeaksi (väri ja leveys sen päivän
kovimmasta tuulesta valoisaan aikaan, 9/9 oikein myös nopeassa polussa).
Se poistettiin silti: kahdeksantoista väripilkkua yhdellä rivillä on
kahdeksantoista asiaa joita silmä yrittää lukea, ja sama tieto on
tuntirivillä alla tarkempana. Kisko on navigointia — sen tehtävä on
viedä päivään, ei kilpailla sen kanssa mitä päivä sisältää.
`_tlPaivaKaistat`, `State._tlPaivaAlue` ja lapun aria-lisäys poistuivat
samalla.

Päivälappu on nyt pelkkä pilleri ja teksti: 40 px korkea napautuspinta,
30 px korkea pilleri. Taustana ne olisivat sama asia ja pilleristä tulisi
rivin korkuinen laatikko — juuri se raskaus jota kortilta karsittiin.
Napautus mitattuna 7/7.

### Mitä jäi

Poistetut tokenit `--tl-ura` ja `--tl-ura-yla`, poistettu elementti
`#tl-paivat-ura`, poistettu `#tl-wrap::after`. Kortin korkeus on yhä
128 px ja aikajanan käyttäytyminen ennallaan (valittu hetki säilyy
neljällä zoomreitillä 0 h).

---

## Päiväkisko piiloon levossa

Pyyntö oli: kisko näkyisi vain aikajanaa raahattaessa ja pomppaisi
takaisin piiloon. Sellaisenaan siinä on kaksi vikaa, ja molemmat piti
korjata ennen kuin ideaa kannatti toteuttaa.

**1. Oikotie ei saa vaatia sitä työtä jonka se poistaa.** Kisko on
olemassa siksi, että nyt-hetkestä viikon päähän on tuntinauhassa 12
ruudullista raahausta. Jos se paljastuu vain raahaamalla, sen oma
tarkoitus kumoutuu. Herätys on siksi **`pointerdown` koko kääreessä**:
pelkkä kosketus riittää, ja se toimii osui sormi sitten palkkiin,
nappiin, kuplaan tai kiskoon itseensä.

**2. Päivämäärä ei saa kadota.** Kisko oli ainoa paikka jossa päiväys
luki. Kupla sanoi "Ma 08:00", eikä viikonpäivä yksin riitä: akseli on
16,6 vrk, joten sama "Ma" esiintyy kolmesti. Päiväys siirtyi kuplaan
(**"Ma 7. 10:00"**), jolloin piilossa ei ole tietoa jota ei näy muualla.

Projektilla on lisäksi oma mitattu sääntö katoavista kontrolleista
(kelinapin himmennys): *"katoava kontrolli siirtäisi kaiken muun ja
jättäisi käyttäjän ihmettelemään mihin se meni."* Se koski kontrollia
joka katoaa arvaamatta; tämä palaa aina samasta eleestä, ja mikään ei
siirry:

| | kisko auki | kisko piilossa |
|---|---|---|
| kortin korkeus | 128 px | **88 px** |
| tuntirivi | y = 784 | y = 784 |
| play-nappi | y = 788 | y = 788 |
| aikakupla | y = 707 | y = 747 |

**Nolla pikseliä siirtymää** tuntiriville ja napeille. Se ei ole
sattumaa: kiskon korkeus on yksi muuttuja (`--tl-paivat-h`), ja se
kasvattaa sekä kääreen korkeutta että sen ylätäytettä yhtä paljon —
kutistuminen kumoutuu itsensä kanssa ja vain kortin yläreuna laskee.
Kartta vapautuu 40 px.

### Milloin se nukkuu

Lepoaika on 4 s **sormen noususta**, ei kosketuksesta. Ero on olennainen:
janan voi raahata paljon kauemmin kuin neljä sekuntia, ja pelkkä ajastin
olisi kadottanut kiskon kesken eleen. Mitattu 6,5 s kestävällä
raahauksella: kisko pysyy näkyvissä koko eleen ajan ja painuu piiloon
4 s noston jälkeen.

Herätykset: kosketus kääreeseen, käyttäjän oma vieritys (myös heiton
jälkeinen momentum) ja aikajanan näppäimet. **Toiston aikana ei
herätetä** — play ei ole navigointia päivissä, ja herätys joka ruudulla
pitäisi kiskon ikuisesti auki.

Käynnistyksessä kisko on näkyvissä ja painuu piiloon vasta ensimmäisen
lepojakson jälkeen: suoraan piilossa aloittava kisko olisi ominaisuus
jota kukaan ei löydä.

Piilotus on `visibility`, ei pelkkä läpinäkyvyys — muuten laput jäisivät
sarkainkierrokseen ja ruudunlukijan puuhun. Näkyvyys vaihtuu vasta
liu'un jälkeen (`transition-delay`), jottei kisko katoa kesken
häivytyksen. Mitattu piilossa: `visibility: hidden`, lappu ei näy.

> **Mittari nukutti kiskon itse.** Napautusmittarin palautus on
> synteettinen `click`, joka ei laukaise `pointerdown`ia eikä siis
> herätä kiskoa — ja sen odotukset ovat yhteensä yli 4 s. Ensimmäinen
> ajo raportoi siksi 2/7 hutia, jotka olivat mittarin omia: se napautti
> piilossa olevaa kiskoa. Nimenomaisen herätyksen kanssa 7/7.

---

## Spottien tuulisuunnat asteen tarkkuudella

Suunnat olivat 8-suuntaisia nimiä (`bestDirs: ['SE','S','SW']`), jotka
muunnettiin asteiksi ja pisteytettiin lähimmän osuman mukaan. Kolme
pistettä 45° välein on karkea approksimaatio siitä mitä spotti oikeasti
on: **yhtenäinen sektori**, esimerkiksi 113°–248°.

### Malli: nimi TAI kaari, sama mittari

`bestDirs`-alkio on nyt joko vanha nimi (`'SE'`) tai kaari asteina
(`[alku, loppu]`, myötäpäivään). Kenttä ei vaihtunut, joten yksikään
kutsupaikka ei muuttunut — vain alkion tyyppi.

Molemmat kulkevat saman funktion läpi: `suuntaEro(windDeg, bestDirs)`
palauttaa kulmaeron lähimpään suuntaan, ja **kaaren sisällä sen arvo on
0**. Nimi on käytännössä kaari jonka leveys on 0°. Pisteytyskäyrät
(`dirMatchScore`in cos ja `spotIndexOsat`in cos² 80° katkaisulla) eivät
muuttuneet lainkaan — vain se mitä "kulmaero" tarkoittaa.

Mitattu: nimipolku antaa **0 eroa 1800 vertailussa** (5 spottia × 360°),
eli tuotannon pisteet ovat bitilleen samat kunnes dataan tulee kaaria.
Kaaripolku testattu myös 0°:n yli menevällä sektorilla (293°–203°
kattaa 0°, 90°, 180°).

### Työkalu: `tools/suunnat.html`

Suunnat asetetaan kartalta, ei arvaamalla. `npm run dev`, sitten
`/tools/suunnat.html`. Sivu ei ole osa tuotantobuildia (buildin ainoa
sisääntulo on `index.html`; tarkistettu `dist/`-hakemistosta).

- **Spotit luetaan `index.html`:stä ajossa**, ei kopioida työkaluun.
  Kopio vanhenisi heti kun spotteja lisätään — ja tämä on juuri se
  paikka jossa uusi spotti käydään säätämässä.
- Alkuarvo johdetaan vanhoista nimistä: yksi nimi → ±22,5°, useampi →
  lyhin kaikki kattava sektori (myös 0°:n yli, esim. N+S+SW →
  158°–23°).
- Kaari piirtyy spotista **ulospäin siihen suuntaan josta tuulen pitää
  tulla**, ja katkoviivanuoli osoittaa spottiin eli tuulen
  kulkusuuntaan. Ilman nuolta on 50 % mahdollisuus asettaa peilikuva.
- Kaksi kahvaa, koko sektorin kierto raahaamalla, nuolinäppäimet ±1°
  (shift ±5°), useampi kaari per spotti, automaattitallennus
  selaimeen, vienti JSONina.

> **Kompassi ei tarttunut.** Ensimmäinen versio piirsi SVG:n koko oikean
> palstan päälle `position:absolute; inset:0` -tyylillä. Se ei venytä
> `<svg>`:tä: korvatun elementin auto-mitat ovat sen sisäiset 300×150,
> joten kahvat jäivät laatikon ulkopuolelle — mitattuna osoitin osui
> `#kartta`an eikä kahvaan. Samalla `latLngToContainerPoint` antaa
> koordinaatit karttasäiliön nurkasta, joten kompassi oli 52 px
> pielessä ylapalkin verran. Molemmat korjaantuivat kääreellä joka
> sisältää sekä kartan että SVG:n, molemmat `inset:0` + `width/height
> 100%`.

### Mitatut kaaret (2026-09)

Kaaret asetettiin työkalulla kartalta. Vanhat nimet ovat suluissa:

| spotti | kaari | leveys | ennen |
|---|---|---|---|
| Hanko Tulliniemi | 90–230° | 140° | E · S · NW |
| Hanko Silversand | 254–60° | 166° | W · NW |
| Haukilahti | 95–250° | 155° | SE · S · SW |
| Lauttasaari | 159–251° | 92° | S · SW |
| Otaniemi | 19–69° | 50° | NE |
| Munkkiniemi | 190–322° | 132° | SW · W |
| Hietaniemi | 239–282° | 43° | W |
| Kruunuvuorenranta | 180–23° | 203° | N · S · SW |
| Puuskaniemi | 94–133° | 39° | SE |
| Kallahti | 143–293° | 150° | S · SW · W |
| Porkkala | 210–286° | 76° | NW |
| Emäsalo | 76–250° | 174° | SE · S · SW |

Tarkistettu koodista: kaaren sisällä `suuntaEro` on 0, reunoilla tasan 0,
yksi aste ulkona 1, ja 0°:n yli menevät kaaret (254–60, 180–23) toimivat.

**Pisteet nousivat, kuten pitikin.** Kolme pistettä 45° välein jätti
kuoppia väliin; yhtenäinen kaari antaa täydet suuntapisteet koko
sektorille. Mitattuna 11 m/s ja 360 suuntaa per spotti, keskimuutos
+3,3…+10,3 pistettä, ja yhdeksällä spotilla kaksitoista ei laske
yhtään suuntaa.

**Kolme asiaa jotka kavenivat — nämä ovat päätöksiä, eivät vikoja:**

1. **Hanko Tulliniemi menetti luoteen.** Vanha lista oli E · S · NW, ja
   uusi kaari 90–230° ei sisällä luodetta lainkaan. Mitattuna 109
   suuntaa 360:stä saa nyt vähemmän pisteitä (pahimmillaan −30), ja
   "väärä suunta" -sanoma kattaa 59 astetta kun ennen se ei kattanut
   yhtään.
2. **Porkkalan kuvaus on nyt ristiriidassa datan kanssa.** `desc` sanoo
   "Avomeri – luoteistuulet", mutta 210–286° päättyy 29 astetta ennen
   luodetta (315°). Sama koskee Kallahtia: "itätuulet", mutta 143–293°
   ei sisällä itää. (Otaniemen "lounas" oli ristiriidassa jo ennen tätä:
   sen data oli NE.)
3. **Kruunuvuorenranta ei enää koskaan sano "väärä suunta".** Kaari on
   203° eli yli puolet kompassista, joten jokainen suunta on alle 80°
   päässä siitä. Ennen 19 astetta 360:stä sai sen sanoman.

`spotIndexSelite` näytti suunnat käyttäjälle `join(' · ')`:llä, mikä
olisi tulostanut kaaresta merkkijonon "95,250" — luku joka näyttää
koordinaatilta. `suunnatTekstina()` muotoilee kaaren muotoon "95–250°"
ja päästää nimet läpi sellaisenaan.

> **Työkalun oma vienti ei ollut kelvollista JSONia.** Jokaisen rivin
> perässä oli pilkku, myös viimeisen, joten "Liitä takaisin" olisi
> kaatunut juuri siihen tekstiin jonka työkalu itse tuotti. Pilkku on
> nyt rivien VÄLISSÄ.

---

## Saavutettavuuserä 1: rakenne, sarkain ja piilotus

Ammattimaisen UI-auditin tarkistuslista ajettiin läpi mitaten. Visuaalinen
puoli oli jo kunnossa; **kaikki kriittinen puute oli semantiikassa ja
näppäimistössä.**

| | ennen | jälkeen |
|---|---|---|
| otsikot (`h1`–`h6`) | **0** | H1 + H2 |
| maamerkit (`main` ym.) | **0** | `div[role=main]` |
| fokusoitavia yhteensä | 36 | 19 |
| niistä karttamerkkejä | **19** | 0 |
| merkkejä ilman nimeä | **7** | 0 |
| ensimmäinen sovelluskontrolli | sarkaimen kohta **20** | kohta 0 |
| suljetun paneelin kontrollit fokusoituvat | **kyllä** | ei |

### Mitä tehtiin

**Ohituslinkki ja otsikko.** Kartalla on 12 fokusoitavaa spottimerkkiä,
joten ilman ohituslinkkiä näppäimistökäyttäjä painaa sarkainta 12 kertaa
ennen yhtäkään kontrollia. `#ohita` on ensimmäinen fokusoitava elementti,
piilossa kunnes se saa fokuksen, ja vie `#btn-spots-wrap`iin. Sivulla ei
ollut yhtään otsikkoa; nyt piilotettu `h1` nimeää sovelluksen ja
asetuspaneelin otsikko on `h2`.

**Karttamerkit.** CLAUDE.md sanoi jo *"Havaintoasemien merkit ovat
`keyboard: false`"* — mutta koko koodissa ei ollut yhtään
`keyboard:false`-asetusta. Sääntö oli kirjattu ja toteuttamatta. Nyt
asemamerkit (19 kpl) ovat poissa sarkainkierrosta ja spottimerkit (12 kpl)
saivat nimen. Varmistettu testidatalla, koska harness estää sen
rajapinnan josta spottien ennuste tulee: **12 merkkiä, 12 nimeä, 12
sarkaimessa.**

**Neljä kontrollia näppäimistölle.** `btn-loc`, `btn-freespot`, `fc-btn`
ja `btn-settings` olivat `div`ejä ilman roolia ja tabindexiä. Pelkkä
`role="button"` ei riitä: divillä Enter ja välilyönti eivät laukaise
clickiä, joten fokuspysäkki olisi ollut pysäkki jolla ei voi tehdä
mitään. Yksi dokumenttitason käsittelijä hoitaa aktivoinnin kaikille.
Globaali näppäinkäsittelijä ohittaa nyt tapauksen jossa fokus on
kontrollissa — muuten välilyönti play-napin päällä olisi laukaissut
toiston kahdesti eli ei kertaakaan. Mitattu: Enter avaa, välilyönti avaa,
play menee päälle ja pois.

**Suljetut paneelit pois sarkainkierrosta.** CLAUDE.md sanoi tämänkin jo,
mutta `visibility: hidden` esiintyi koko koodissa kolmesti eikä yksikään
niistä ollut paneeli. Mitattuna suljetun asetuspaneelin kolme kontrollia
fokusoituivat vaikka paneeli oli kokonaan ruudun ulkopuolella. Nyt
asetuspaneeli, spottikortti ja ennustepaneeli piiloutuvat `visibility`illä
liu'un jälkeen (`transition-delay`), kuten päiväkisko.

### Kaksi löydöstä joita listalla ei ollut

**Kuollutta markupia bodyssä.** `<div class="sl-header">Spotit</div>` ja
`#sl-items` roikkuivat suoraan bodyssä ilman vanhempaa — mitattuna
**elävä, näkyvä 393×38 px elementti kohdassa y=0**, jota mikään JS ei
käyttänyt. Sen mukana oli ylimääräinen `</div>`, joka sulki `#app`:n
väärässä paikassa: `#app` päättyi heti kartan jälkeen, ja koko muu
käyttöliittymä oli sen ulkopuolella. Molemmat poistettu, ja `#app`
sulkeutuu nyt lopussa — mikä oli myös edellytys sille että
`role="main"` kattaa oikeasti sisällön. Geometria mitattu ennen ja
jälkeen: seitsemän avainelementtiä samoissa pikseleissä.

**Ennustepaneelin kytkimet olivat `display: none`.** `.fc-toggle input`
oli piilotettu niin että kytkin ei ollut fokusoitavissa eikä
ruudunlukijan tavoitettavissa **edes paneelin ollessa auki**. Piilotus on
nyt 1×1 px:n leikkaus, jolloin ulkoasu säilyy mutta kytkin on olemassa;
fokus näkyy `.fc-track`issa.

### Kaksi kohtaa joita EI korjattu — ne olivat mittarin virheitä

Ensimmäinen auditti väitti kahta kosketuskohdetta liian pieneksi.
Molemmat olivat mittarin omia:

- `#nettitila-nappi` 99×26 px — mutta sirulla on `min-height: 44px` ja
  napilla `pointer-events: none`, eli napautus menee sirulle
  tarkoituksella. Kohde on 44 px.
- `#fc-handle` 393×20 px — koristeellinen tarttumatanko ilman yhtäkään
  käsittelijää. Se oli mittarin valitsinlistassa, ei käyttöliittymässä.

Aiempi väite *"9 jatkuvaa animaatiota"* oli samaa lajia: ne ovat
piilotetun latausruudun elementtejä, ja näkyviä oli **0**.
`getComputedStyle` kertoo animaation myös `display:none` -elementille.

Ja `[role=dialog]`-haku osui pikanäppäinikkunaan eikä asetuspaneeliin:
`visibility` on `visible` myös `display:none` -elementillä, joten mittari
luuli ikkunan olevan auki.

## Saavutettavuuserä 2: dialogit ja fokus

Erä 1 sai suljetut paneelit pois sarkainkierrosta. Auki olevat olivat
yhä koko lailla rikki: ne olivat nimettömiä `div`ejä ilman roolia, ja
sarkain käveli niiden läpi takaisin kartalle ja kontrolleihin joita ei
sillä hetkellä nähnyt.

### Yksi polku, ei kolmea kopiota

Pintoja on neljä (asetukset, spottikortti, ennustepaneeli,
pikanäppäimet) ja niillä on neljä eri avaus- ja sulkupolkua.
Paneelikohtaiset kuuntelijat olisivat ajautuneet erilleen samalla
tavalla kuin aikajanan valinta ennen `_tlValitseIdx`:iä, joten kaikki
menee `Modaali`-moduulin kautta: `avaa(el, avaaja)`, `sulje(el)` ja
yksi dokumenttitason sarkainansa joka lukee pinon päällimmäisen.

`aria-modal="true"` hoitaa ruudunlukijan mutta **ei sarkainta** — ansa
on tehtävä itse. `inert`iä ei voi käyttää, koska paneelit ovat `#app`:n
sisällä.

### Kolme asiaa jotka mittaus paljasti

**Avaus on oltava idempotentti.** `openSheet` kutsutaan uudelleen joka
aikajanan askeleella (`if (State.sheetSpot) openSheet(...)`). Jos avaus
siirtäisi fokuksen joka kerta, jokainen tunnin askel veisi fokuksen
pois siitä napista jota käyttäjä juuri painoi. Mitattu: askel ei siirrä
fokusta (`sheet-handle → sheet-handle`).

**Paluukohde on ETSITTÄVÄ UUDELLEEN, ei pelkkä viite.** Spottikortin
avaaja on karttamerkki, ja `renderSpots` korvaa merkin uudella solmulla
joka piirrolla. Tallennettu elementtiviite osoitti irronneeseen
solmuun, ja fokus jäi bodyyn (mitattu). Nyt viitteen rinnalla
talletetaan `id` ja `title`, joilla kohde löytyy uudelleenpiirron
jälkeenkin — mitattu `div.leaflet-marker-icon → div.leaflet-marker-icon`.

**Fokus menee SÄILIÖÖN, ei ensimmäiseen kontrolliin.** Säiliö kantaa
roolin ja nimen, joten ruudunlukija lukee "Asetukset, valintaikkuna" —
ensimmäiseen nappiin siirtyvä fokus jättäisi sen sanomatta. Säiliöltä
otetaan ääriviiva pois (`[role="dialog"]:focus`), koska fokus on siinä
mekanismi eikä kontrolli.

### Mitattu ennen ja jälkeen

Jokainen paneeli avataan sillä kontrollilla jolla käyttäjäkin sen avaa,
ja sarkainta painetaan oikeasti (`page.keyboard.press`) — syntetisoitu
`KeyboardEvent` ei siirrä fokusta, se vain laukaisee kuuntelijat.

| | ennen | jälkeen |
|---|---|---|
| `role="dialog"` neljällä pinnalla | 1/4 | 4/4 |
| saavutettava nimi | 1/4 | 4/4 |
| fokus siirtyy sisään avattaessa | 0/4 | 4/4 |
| sarkain pysyy paneelissa | 0/4 | 4/4 |
| Esc sulkee | 3/4 | 4/4 |
| fokus palautuu avaajaan | 0/4 | 4/4 |

Esc ei sulkenut asetuksia, vaikka sääntö sanoi että sen pitää — se on
nyt Esc-ketjussa.

Spottikortin nimi vaihtuu sisällön mukaan (spotti tai havaintoasema),
joten se asetetaan avattaessa (`_sheetAuki`) eikä markupissa.

### Sivuvaikutus jonka mittaus otti kiinni

`#sp-title` ja `#fc-title` vaihtuivat `div`istä otsikoiksi, ja selaimen
oma `h2`-marginaali olisi siirtänyt molempia ylätunnisteita. Geometria
on nyt mitattu yhdeksällä avainelementillä molemmissa näkymissä
(mobiili ja työpöytä) commit `75aa388` vasten: **pikselilleen sama**.

## Saavutettavuuserä 3: asetuspaneelin kontrollit

Erä 2 teki asetuspaneelista dialogin jossa on fokusansa. Mittaus sen
jälkeen paljasti mitä ansan sisällä oli:

| | ennen | jälkeen |
|---|---|---|
| kontrolleja paneelissa | 22 | 22 |
| **niistä sarkaimella tavoitettavia** | **0** | **22** |
| sarkainpysäkkejä paneelissa | 3 | 14 |

Kolme pysäkkiä olivat "Valmis" ja kaksi karttalähteen linkkiä. Kaikki
viisi kerroskytkintä ja kaikki 17 sirua olivat divejä joilla oli vain
klikkauskuuntelija. Ansa siis vangitsi fokuksen sisältöön johon ei
päässyt käsiksi.

### Roolit luetaan rakenteesta, ei kirjoiteta markupiin

22 elementtiin käsin kirjoitettu `role` + `tabindex` + `aria-checked`
olisi 22 paikkaa jotka ajautuvat erilleen ensimmäisessä muutoksessa.
Ne johdetaan kerran rakenteesta, jolloin uusi siru saa saman kohtelun
ilman lisätyötä — kuten uusi aaltopoijukytkin sai.

Ryhmän nimi tulee sitä edeltävästä `.sp-label`-otsikosta
(`aria-labelledby`), ei toiseen kertaan kirjoitetusta `aria-label`ista:
kaksi kopiota samasta tekstistä ajautuu erilleen.

### Siruryhmä on radiogroup, ei nappirivi

Ero ei ole kosmeettinen. Ruudunlukija sanoo "2 / 4", ja **sarkain näkee
ryhmän yhtenä pysäkkinä** vaeltavan tabindexin ansiosta — muuten 17
sirua olisi 17 pysäkkiä ja paneelin läpikävely maksaisi enemmän kuin se
säästää. Ryhmän sisällä liikutaan nuolilla, ja **valinta seuraa
fokusta**: se on radiogroupin standardikuvio, ja se on myös ainoa joka
toimii tässä sovelluksessa, koska sirun valinta ajetaan ryhmän
delegoidusta klikkauskäsittelijästä — pelkkä fokuksen siirto ei tekisi
mitään ja käyttäjä jäisi ihmettelemään miksi mikään ei muutu.

Nuolet vaativat `stopPropagation`in eikä pelkkää `preventDefault`ia:
nuolet kuuluvat muuten Leafletille, joka panoroi niillä karttaa.
Mitattu — neljä nuolenpainallusta sirun päällä, kartan keskipiste
62,500000/25,500000 ennen ja jälkeen.

Kerroskytkin on `role="switch"`, koska se on päällä/pois eikä
yksivalinta. Nimi tulee `.sp-toggle-name`istä ja selite
(`aria-describedby`) `.sp-toggle-sub`ista.

### Tila synkataan MutationObserverilla

`.active` ja `.on` asetetaan **kuudessa eri paikassa**
(`KarttaAsetukset._merkitse`, `applyUnit`, `#layers`, `#units`,
kerroskytkimet, käynnistyksen `_merkitseKarttatasot`). Aria-tilan
kirjoittaminen jokaiseen niistä olisi ollut seitsemäs polku samaan
asiaan — sama vika kuin aikajanan valinnalla ennen `_tlValitseIdx`:iä.
Havainnointi on yksi polku ja se pysyy oikeassa myös silloin kun luokka
vaihtuu koodista jota ei ole vielä olemassa. Silmukkaa ei synny, koska
suodatin on `class` eikä synkka kirjoita luokkia.

### Mitattu

39 tarkistusta, 0 vikaa, molemmissa näkymissä: roolit ja nimet kuudella
ryhmällä ja viidellä kytkimellä, `aria-checked` vastaa luokkaa
kaikkialla, tasan yksi sarkainpysäkki ryhmää kohti, nuoli siirtää ja
valitsee kolmessa ryhmässä ja palaa takaisin, väli ja Enter kytkevät
kerrostason ja `aria-checked` seuraa, Esc sulkee ja fokus palaa
avaajaan, suljettuna mikään ei ole fokusoitavissa.

Sivun näkyvistä kontrolleista fokusoitavia 26/26 → **48/48**.

## Oletusasetukset ja sirujen järjestys

Oletukset ovat nyt: tuulikerros **Tuuli**, yksikkö **solmua**,
pohjakartta **Tumma**, partikkelit **Normaali**. Jokaisessa
siruryhmässä oletus on **ensimmäisenä vasemmalla** — valinta luetaan
vasemmalta, ja oletuksen paikka kertoo mikä on lähtötila ilman että
sitä tarvitsee päätellä siitä mikä sattuu olemaan korostettuna.

Yksikkö vaihtui solmuun, koska kalusto valitaan solmuissa. Sama
järjestys on myös kapselin yksikkövalitsimessa: kaksi eri järjestystä
samalle listalle olisi kaksi paikkaa jotka ajautuvat erilleen.

### Partikkelien nimet vaihtuivat, AVAIMET EIVÄT

    'vahan'    → "Normaali"   (uusi oletus)
    'normaali' → "Paljon"
    'pois'     → "Pois"

Avaimen vaihtaminen nimen mukana olisi pudottanut jokaisen käyttäjän
tallennetun valinnan oletukseen — sama sääntö kuin väriasteikon
`'nykyinen'`-avaimella, joka on yhä nimeltään "Kirkas". Mitattu: kun
localStoragessa on vanha `{pohja:'vaalea', partikkelit:'normaali',
ramppi:'cvd', lampo:'voimakas'}` ja yksikkö `ms`, kaikki viisi säilyvät
eivätkä putoa uusiin oletuksiin.

Lämpökartan voimakkuutta ja väriasteikkoa ei siirretty: niiden
järjestys on asteikko (hillitty → voimakas), ja oletuksen nostaminen
ensimmäiseksi rikkoisi sen. Ne eivät myöskään olleet pyydettyjen
oletusten joukossa.

## Aaltopoijun lukema tulee samalla zoomilla kuin meriaseman

Poijun pillerikynnys oli z9 peiton takia — z8:lla pillerit peittivät
toisensa Helsingin edustalla 65-prosenttisesti. Se ratkaisu oli
mittauksena oikea mutta käyttöliittymänä väärä: **Suomenlahden poiju
ilmestyi vasta lähempänä kuin Harmajan lukema**, vaikka molemmat ovat
merihavaintoja samalla alueella, ja käyttäjä huomasi sen.

Ratkaisu ei ole kynnys vaan **koko**. Merkki kasvaa portaittain sen
sijaan että ilmestyisi tyhjästä:

    z < 8    glyfi (13 px)
    z 8      kapea pilleri (44 px) — pienempi luku, tiukempi täyte
    z ≥ 9    täysi pilleri (51 px)

`_pilleri` sai valinnaisen `pieni`-lipun; yksikkö on jo pienimmässä
käytössä olevassa koossa (`--fs-65`), joten vain luku pienenee.

Mitattu peitto sisemmistä elementeistä: **z8 pahin pari on Harmaja ×
Itätoukki 36 %** eli perustason pari johon poiju ei kuulu, ja z9–z12
on 0 %. z7:llä poijun glyfi on yhä 90-prosenttisesti Harmajan pisteen
alla — se on pistetilan tungosta, jota väistö ei korjaa (ks.
*Aaltopoijut*), ja se on ennallaan.

## Aaltopoijun kaavion voi raahata

Kaaviosta näki vain muodon; yksittäisen tunnin lukemaa ei saanut esiin.
Nyt sormella (tai hiirellä) raahaamalla kaavioon tulee pystyosoitin ja
otsikkoriville aika, korkeus ja aallon suunta.

**Lukema kirjoitetaan otsikkoriville, ei kelluvaan kuplaan.** Kaavio on
spottikortissa 108 px korkea, ja kupla joko peittäisi käyrän tai valuisi
kortin reunan yli. Otsikkorivi on jo olemassa ja sanoo muutenkin mitä
katsotaan.

Kolme asiaa jotka piti tehdä oikein:

- **`touch-action: none`** kaaviolle. Ilman sitä pystysuora sormen liike
  vierittää spottikorttia eikä raahaus ala koskaan. Sama ratkaisu kuin
  uimavesikaaviossa.
- **`setPointerCapture`.** Ilman sitä lukema jää jumiin siihen kohtaan
  jossa sormi liukui kaavion reunan yli.
- **Lukema jää näkyviin sormen noustua** (2,6 s). Ensimmäinen versio
  piilotti sen heti `pointerup`issa, ja mittaus paljasti mitä se
  tarkoittaa: **napautus ei tehnyt yhtään mitään**. Napautus on yhtä
  laillinen ele kuin raahaus — "mikä tämä kohta oli". Ajastin palauttaa
  otsikon itsestään, jottei kortille jää pysyvää merkkiä jota kukaan ei
  pyytänyt.

Pointer-tapahtumat eikä touch + mouse erikseen: sama koodi kattaa
sormen, hiiren ja kynän, eikä kahta polkua pääse ajautumaan erilleen.
`pointerleave` on rajattu hiireen, koska kosketuksella se tulee vasta
noston jälkeen.

Mitattu kolmesta kohdasta (15 %, 45 %, 85 %): osoitin näkyy, otsikko
näyttää päivän, kellonajan, korkeuden ja suunnan, kolme kohtaa antavat
kolme eri lukemaa, ja otsikko palautuu itsestään.

## Kapselin puuskarivi katosi — kaksi vikaa, ja yksi ilmeinen korjaus joka oli väärä

Kapselin tuulilukeman alla on pieni harmaa rivi "puuska N". Se oli
poissa. Elementti oli paikallaan ja sisälsi tekstiä, mutta luokka
`hidden` piti sen `visibility: hidden` -tilassa.

Ensimmäinen mittaus seitsemästä paikasta kertoi mistä oli kyse:

| paikka | kapseli | puuskarivi | lähin piste | puuska | rivin hetki |
|---|---|---|---|---|---|
| Helsinki | 13,3 kts | näkyy | api 3 km | 7,8 | 2026-09-10T10:00 |
| Lauttasaari | 12,6 kts | näkyy | api 0 km | 7,9 | 2026-09-10T10:00 |
| Harmaja | 14,7 kts | näkyy | api 7 km | 8,1 | 2026-09-10T10:00 |
| Vuosaari | 13,2 kts | **PIILOSSA** | api 4 km | 6,3 | 2026-09-10T10:00 |
| Hanko | 18,9 kts | **PIILOSSA** | api 2 km | 5,5 | 2026-09-10T10:00 |
| Avomeri | 21,5 kts | näkyy | laatta 0 km | 14,4 | 2026-09-08T10:00 |
| Uloin | 12,1 kts | näkyy | laatta 0 km | 13,3 | 2026-09-08T10:00 |

Sama indeksi 52 osoitti laattapisteessä hetkeen **2026-09-08T10:00** ja
rajapintapisteessä hetkeen **2026-09-10T10:00**. Mittaus tehtiin
8.9.2026, eli rajapintapisteen luku oli **48 tuntia tulevaisuudesta**.

### Vika 1: indeksi siirrettiin akselilta toiselle

`Crosshair._puuska` teki `Math.min(State.currentHourIdx, ...)`.
`State.currentHourIdx` on AIKAJANAN indeksi, ja aikajana lukee
laattavarastoa; lähin ennustepiste on Suomessa käytännössä aina spotti
omalla HARMONIE-akselillaan, joka ei ala samasta hetkestä. Tämä on
täsmälleen se vika jota vastaan `_tlSailytaHetki` on olemassa ja jonka
takia `_spotIdx` kirjoitettiin yhdeksi funktioksi kolmen kopion sijaan —
tämä oli neljäs paikka, ja se jäi huomaamatta koska se ei ollut
`renderSpots`in naapurissa.

Väärän tunnin puuska ei vain näyttänyt väärää lukua: kahdessa paikassa
seitsemästä se oli PIENEMPI kuin nykyhetken tuuli, jolloin ehto
"puuska yli 5 % keskituulesta" hylkäsi sen ja koko rivi katosi. Ne
viisi joissa rivi näkyi, näyttivät ylihuomisen puuskan.

### Vika 2 — ja korjaus joka oli väärä

Ilmeinen jatkokorjaus: kun kapselin luku tulee varastosta
(`sampleWindHilasta`, ja juuri sen lähdemerkintä nimeää), lue puuskakin
varastosta. Se toteutettiin, ja se mitattiin rikki.

Varaston oma sarja Harmajalla, kolmen tunnin raaka-akseli:

```
09-06T06  7,1 / 7,1   1,00      09-06T18  6,4 / 6,4   1,00
09-06T09  7,0 / 12,0  1,72      09-06T21  6,0 / 9,2   1,55
09-06T12  6,4 / 6,4   1,00      09-07T00  5,3 / 5,3   1,00
09-06T15  7,1 / 11,4  1,59      09-07T03  4,8 / 8,1   1,67
```

Puuska puuttuu **joka toiselta askeleelta** (26/99), ja laattojen
rakennus täyttää aukon tuulen omalla arvolla (`puu[t] = nop[t]`).
Rivi olisi siis vilkkunut päälle ja pois joka toisella aikajanan
askeleella. Ja ne askeleet joilla puuska on, ovat kuuden tunnin
maksimeja: suhde 1,55–1,77, kun HARMONIEn tuntipuuska samassa
pisteessä on 1,25 ja Harmajan mitattu havainto samalla hetkellä 1,16
(ws 8,0, puuska 9,3). Kapselin puuska on tunnin luku, ei vuorokauden
pahin hetki.

### Mikä jäi

Puuska luetaan lähimmästä RAJAPINTApisteestä, jolla on aito
tuntikohtainen puuskasarja (`_puuskaPiste`), ja indeksi haetaan ajasta
`_spotIdx`:llä. Laattapisteet ohitetaan.

Vertailu tehdään sarjan sisällä — puuskaa verrataan saman sarjan samaan
tuntiin, ei kapselin bikuubiseen varastonäytteeseen. Muuten "yli 5 %"
vertaisi kahta mallia toisiinsa, ja ne ovat mitattuna keskimäärin
1,38 m/s eri mieltä.

Etäisyysraja on `3 × step`, lattiana 0,5° — **tiukempi kuin
lähdemerkinnällä eikä siinä ole `LAHDE_RAJA_MIN`-lattiaa**. Merkintä
vastaa kysymykseen "minkä mallin aluetta tämä on", johon kaukainenkin
piste kelpaa; puuska on paikan lukema. Mitattuna löytynyt piste on
Suomessa 0–7 km päässä, z8:lla 63 km ja z6:lla 200 km — kaikki hyvin
rajan sisällä, joten kahdeksan asteen lattia ei auttanut missään
mitatussa tilanteessa mutta olisi kattamattomalla alueella päästänyt
läpi lukeman 900 km:n päästä.

Tulos muistetaan keskipisteelle ja tunnille, koska `_update` ajetaan
60 ms:n välein sormenliikkeen aikana. **Muisti tyhjennetään
`refresh`issä**, ei vain avaimen vaihtuessa: `refresh` ajetaan juuri
silloin kun varasto on saanut uutta dataa samaan kohtaan, ja ilman
tyhjennystä ensilatauksen tyhjä tulos jäisi voimaan.

Mitattu jälkeen: rivi näkyy 7/7 paikassa, näytetty luku vastaa
rajapintapisteen tuntipuuskaa nykyhetkestä (ero alle 0,15 kts), 0
konsolivirhettä.

## Vuosaaren asema sanoi "ei signaalia" — koska asemaa ei enää ole

Kartalla oli Vuosaaren sataman kohdalla katkoviivainen pilleri jossa
luki "ei signaalia", pysyvästi. Ensin selvitettiin miksi, vasta sitten
korjattiin.

FMI:n avoin data, FMISID 151028 "Helsinki Vuosaari satama":

- 3 h ikkuna nyt: nolla riviä (vastaus 1 991 tavua, tyhjä kokoelma)
- sama tyhjä vastaus kaikilla parametreilla (`WindSpeedMS`, `t2m`,
  `WAWA`) ja molemmilla kyselymuodoilla (timevaluepair,
  multipointcoverage)
- vuosi sitten (1.9.2025) samasta asemasta tuli dataa
- puolitushaku: **viimeinen havainto 18.8.2026**, sen jälkeen ei mitään

Asema on yhä FMI:n asemarekisterissä (`fmi::ef::stations`, verkko 121
"Automaattinen sääasema", toimintajakso "now"), eli rekisteri ei kerro
sen lakanneen. Vain havainnot kertovat.

Korvaajaa etsittiin viidestä lähteestä, eikä sitä ole:

| lähde | tulos |
|---|---|
| FMI, kaikki asemat 12 km säteellä | 151028 (hiljaa), 103943 Käärmeniementie (ei koskaan dataa avoimessa datassa), loput ilmanlaatuasemia |
| FMI, bbox 0,2° ympärillä | vain Malmi 9,7 km ja Itätoukki 12 km |
| HSY:n ilmanlaatuasema 104089 "Helsinki Vuosaaren satama" | `airquality`-kysely ei tunne asemaa eikä tuuliparametreja |
| Marine Helsinki (swell.fmi.fi) | vain Harmaja ja Kruunuvuorenselkä |
| Digitraffic, tiesääasemat | neljä lähintä `REMOVED_TEMPORARILY`, seuraava 6,1 km sisämaassa |
| dlarah.org | ei Vuosaaren asemaa (Laru, eira, Bågaskär, Tulliniemi, Russarö, Vänö, Utö, Tahkoluoto, Tankar, Marjaniemi, Vihreäsaari) |

Vuosaaressa ei siis ole tuulihavaintoa. Ennuste siellä toimii kuten
ennenkin; havaintoa ei vain ole olemassa.

### Katko ja lakkautus ovat eri asia

"Ei signaalia" tehtiin kuuden vuorokauden katkoa varten: asema on
olemassa, se palaa, ja katkoviiva kertoo ettei vika ole sovelluksessa.
Kolme viikkoa hiljaa ollut asema ei ole katko, ja silloin sama pilleri
on lupaus jota ei lunasteta koskaan.

`_fmiLoadWithFallback` antaa nyt `onFail`ille SYYN:

- `'tyhja'` — vastaus tuli ja se oli tyhjä koko ikkunalta (proxyn oma
  `error: 'no data'` + `ws: []`, HTTP 200). Asema ei ole
  havaintoverkossa juuri nyt → merkki ja sen ruksi otetaan kartalta
  kokonaan pois.
- `'verkko'` — pyyntö kaatui tai palautti poikkeuksen (HTTP 500).
  Asemasta ei tiedetä mitään → katkoviivainen "ei signaalia" jää.

Ratkaisu paranee itsestään kumpaankin suuntaan: jos FMI jatkaa
lähettämistä, merkki palaa seuraavassa latauksessa, eikä koodiin jää
käsin ylläpidettävää poistolistaa.

**Ensimmäinen yritys luokitteli väärin.** Ehto oli
`!results[1].value.error`, ja proxy palauttaa juuri tässä tapauksessa
`error: 'no data'` — eli tyhjä vastaus meni haaraan `'verkko'` ja
mikään ei muuttunut. Merkkijono `'no data'` on proxyn oma merkintä
tälle tilanteelle; muut virheviestit tulevat poikkeuksesta.

Mitattu jälkeen (z9, Helsinki): 12 asemaa antaa lukeman, Vuosaari on
poissa `_obsMarkers`ista, "ei signaalia" -merkkejä ruudulla 0.

**Kontrolli toisin päin, ja se on tässä koko turvaverkko:** kun
`/api/fmi` katkaistaan (`abort`) tai se palauttaa 500:n, kaikki 13
merkkiä JÄÄVÄT kartalle ja 11 niistä on hiljaisia. Ilman tätä
tarkistusta yksi verkkokatko olisi pyyhkinyt havaintoasemat kartalta.

## Havaintokaavio uusiksi: väri tulee korkeudesta

Käyttäjä pyysi havaintoasemille Windgurun tuulikaavion kaltaista näkymää
mobiilille. Lähdekuvan olennainen keksintö ei ole mikään yksittäinen
elementti vaan se, että **täytön väri on funktio KORKEUDESTA**: vaakaviipale
korkeudella y saa sen nopeuden värin jota y edustaa akselilla. Silloin
"pääseekö vesille" luetaan pinnasta ilman että akselia katsoo.

Vanha kaavio oli sävytetty viiva ja harmaa puuskavyöhyke. Uusi on
kolme käyrää värillisen täytön päällä.

### Ensimmäinen mittaus kaatoi ilmeisen toteutuksen

Luonteva ensiajatus: täyttö `ink()`-rampilla, sama jolla viiva jo
piirtyi. Mitattuna se on mahdoton — musteviiva katoaa oman ramppinsa
päälle:

| m/s | ink/paperi |
|---|---|
| 0 | 3,33 |
| 4 | **1,23** |
| 6 | **1,14** |
| 8 | 1,39 |
| 12 | 1,78 |
| 20 | 1,84 |

Mediaani 1,6 ja pohja 1,14 juuri sillä 4–8 m/s alueella joka ratkaisee.
Syy on rakenteellinen: täytön väri ja viivan väri johdetaan samasta
nopeudesta, joten ne seuraavat toisiaan eivätkä voi erota.

### Ratkaisu: yksi kanava, yksi merkitys

**Täyttö kantaa arvon, viivat kantavat muodon.** Kun täyttö kertoo
nopeuden, viivan väri olisi sama tieto toiseen kertaan — ja juuri se
söi kontrastin. Viivat ovat kiinteää mustetta.

Mikä muste? Pienin kontrasti koko alueella 0–26 m/s, täyttöä vasten:

| muste | a=0,28 | a=0,40 | a=0,55 | a=0,70 |
|---|---|---|---|---|
| `--ink` (16,26,32) | 8,57 | 6,23 | **3,94** | 2,35 |
| `--ink-2` (76,89,96) | 3,51 | 2,55 | 1,61 | 1,04 |
| `--ink-3` (95,105,111) | 2,73 | 1,98 | 1,25 | 1,03 |

`--ink` on ainoa joka kestää. Se on myös eri muste kuin kaavioissa
siihen asti käytetty `#4C5960` — sama asia kuin `--ink-2`, eli 1,61:1.

Täyttö on `ColorRamp.paperi()` eli karttaramppi × 0,48, sama jolla
aikajanan palkit piirretään. Alfa nousee korkeuden mukana 0,16 → 0,62:
matala ja haalea = tyyni, korkea ja kylläinen = kova. Heikoin sävy
(10 m/s, oliivi) erottuu paperista 2,17:1 alfalla 0,55.

Pahin yhdistelmä — tumma sininen JA korkea alfa — ei voi esiintyä:
sininen on asteikon pohjassa, jossa alfa on matalin. Alfa ja sävy ovat
molemmat saman korkeuden funktioita.

### `gradientUnits="userSpaceOnUse"` ei ole valinnainen

Oletusarvoinen `objectBoundingBox` suhteuttaisi gradientin
**täyttöpolun** rajauslaatikkoon, jonka yläreuna on korkein
puuskapiikki — ei piirtoalueen ylälaita. Väri ja akseli irtoaisivat
toisistaan heti kun tuuli ei yllä asteikon huippuun, eli lähes aina.

Gradientin pysäkit otetaan **m/s-asteikolla** ja sijoitetaan sinne
minne ne y-akselilla osuvat. Käänteistä yksikkömuunnosta ei ole eikä
tarvita — bofori ei olisi käännettävissä lainkaan.

### Y-akselin väriliuska

Lähteessä väriasteikko on erillinen palkki oikeassa reunassa.
Mobiilissa sille ei ole leveyttä, ja akselin viereen se kuuluu
muutenkin: kolmen yksikön liuska samalla gradientilla y-akselin
vieressä tekee korkeudesta, numerosta ja väristä näkyvästi saman asian.

### Ei vaakavieritystä

Lähde näyttää ~10 h 1900 pikselissä. Mobiilissa on 266 yksikköä, eli
17× vähemmän. Silti vieritystä ei tarvita: kuvaaja niputtaa 24 h
noin 110 pisteeseen eli **13 minuuttiin per piste**, mikä on tiheämpi
kuin lähteen oma 30 minuutin askel. Muoto siis säilyy täysin —
vain nimikyltit eivät mahtuisi, eikä niitä yritetä mahduttaa.

Vieritys olisi lisäksi maksanut raahauksen: kaaviota luetaan sormella
vetämällä, ja vaakavieritys söisi sen eleen.

### Yö ja päivä — ja mittaus joka kumosi epäilyni

Harso käyttää samaa `Aurinko.vaihe`-jakoa ja samoja alfoja kuin
aikajana (.13 / .09 / .05), koska ne on jo kertaalleen kalibroitu
kuvaajan päälle kortin paperilla.

**Harso piirtyy täytön PÄÄLLE mutta viivojen ALLA.** Ensin se laitettiin
täytön alle, jotta värisopimus säilyisi koskemattomana. Se mitattiin
väärin: harso näkyi vain siellä missä täyttöä ei ollut eli kuvaajan
yläosassa, ja luki harmaana korostuslaatikkona eikä yönä. Päällä se
himmentää sarakkeen tasaisesti, jolloin sävyjen keskinäinen järjestys
säilyy ja viivojen mitattu kontrasti ei muutu.

Kuvakaappauksesta näytti siltä että kaista alkaa jo ennen klo 18,
vaikka aurinko laskee Helsingissä 9.9. vasta 20:00. Mitattuna
piirretyt rajat olivat:

```
20:03 - 20:46  .05   (siviilihämärä alkaa auringonlaskusta)
20:46 - 22:46  .09
22:46 - 03:50  .13   (yö)
03:50 - 05:50  .09
05:50 - 06:33  .05   (päättyy auringonnousuun)
```

Kaista oli oikein alusta asti. Silmämääräinen pikseliarvio petti,
koska SVG:llä on `margin-left:-22px` ja `width:calc(100% + 22px)` —
kuvan x ei ole viewBoxin x. Vika oli arviossa, ei koodissa.

### Puuskahuippujen numerot

Lähteessä jokainen piste on numeroitu; mobiilissa ei mahdu. Numerot
annetaan paikallisille maksimeille suuruusjärjestyksessä, vähintään 40
yksikön välein, enintään neljä.

Kaksi sääntöä syntyi mittauksesta:

- **Kynnys 55 % vaihteluvälistä.** Ilman sitä lappu meni myös
  vaatimattomalle kumpareelle aina kun isommat sattuivat olemaan
  lähekkäin — 24 h:n jaksossa lapun sai 31,9 ja 27,8, ja kolmanneksi
  19,6, joka on jakson keskitasoa eikä huippu lainkaan.
- **Jakson kovin puuska saa lapun AINA.** Muut huiput väistävät oikeaa
  reunaa, koska siellä on viimeisimmän lukeman piste — ja se sääntö
  sulki 7 vrk:n jaksossa pois juuri sen luvun jonka "Kovin puuska"
  -ruutu alla sanoi: ruudussa 31,9 kts, kaaviossa suurin lappu 29,0.
  Kortti ei saa kertoa kahta eri lukua samasta jaksosta.

Tarkistettu jälkeen yhdeksällä asema/jakso-yhdistelmällä (Harmaja,
Laru, Kruunuvuorenselkä × 6 h / 24 h / 3 vrk / 7 vrk): kaavion suurin
lappu on joka kerta sama luku kuin ruudussa, eikä yksikään lappu
leikkaudu reunan yli.

### Tilastoruudut ovat soluja

Lähteen alarivi on värillisiä soluja. Sama tehtiin ruuduille: tausta on
`paperi()` alfalla .20 silloin kun luku on tuulennopeus, muuten
neutraali `--surface-lo`. Väri kuuluu vain nopeudelle, joten suunta ja
lämpötila jäävät värittömiksi eikä niille keksitä omaa asteikkoa —
mutta ne ovat samannäköisiä soluja, jolloin rivi lukee ryhmänä.

Numero on `--ink` eikä `ink(ms)`: mitattuna 9,94:1 tätä taustaa vasten,
kun sävytetty numero olisi omalla taustallaan paikoin alle 2:1.

### Mitattu lopuksi

Neljä jaksoa × kolme asemaa, mobiili 393×852 ja työpöytä 1440×900:
ei yhtään päällekkäistä huippulappua eikä x-akselin merkintää, yökaistoja
3 / 5 / 15 / 34 jakson mukaan, työpöydällä ei ylivuotoa oikeasta
reunasta, 0 konsolivirhettä. Raahaus toimii: kolme kohtaa antoi kolme
eri lukemaa ja tooltipissa on puuska mukana.

**Ennestään rikki, ei tässä korjattu:** spottikortin sisällä oleva
asemavalitsin (`-fmidd`-slotti) jää tyhjäksi. Sama HEAD-versiossa
ennen tätä muutosta, eli se ei ole tämän erän aiheuttama.

## Havaintokaavion laajennus koko ruudulle

Käyttäjä kysyi pitäisikö kaavioiden olla eri kokoisia ja voisiko ne
laajentaa koko näytölle. Mittasin ensin lähtötilanteen, ja kaksi lukua
ohjasivat koko ratkaisun:

| | pysty 393×852 | vaaka 852×393 |
|---|---|---|
| kortin sisältö / näkyvä ala | 541 / 595 px | 797 / 322 px |
| kaavio | 375×209 px | 834×464 px |
| piirtoalue | 333×165 px | 739×367 px |
| tiheys 24 h | 13,9 px/tunti | 30,8 px/tunti |

**Kortti ei vieritä pystyssä — tilaa on 54 px yli.** Kaavio ei siis ole
ahtaalla kortin takia vaan ruudun leveyden takia. Korkeus ei ole
pullonkaula.

**Aikasarja tarvitsee leveyttä.** Siksi pystysuora koko ruutu ei ratkaise
mitään: se antaa lisää korkeutta, jota on jo. Vaaka antaa 2,2×.

**Vaakatila ei ole ilmainen.** Nykyasettelulla vaakaruudulla SVG venyy
834×**464** px — korkeammaksi kuin koko 393 px:n ruutu, koska viewBoxin
kuvasuhde skaalautuu leveyden mukana. Laajennettu näkymä ei siis ole
kortin kaavio venytettynä vaan oma kuvasuhteensa.

### Kaksi kokoa, yksi piirtofunktio

Kaikki mikä eroaa on taulukossa (`HAV_ASU_KORTTI`, `HAV_ASU_PYSTY`,
`HAV_ASU_LAAJA`), ei koodihaaroissa. Kaksi piirtofunktiota ajautuisi
erilleen ensimmäisessä säädössä.

Laajassa vaakanäkymässä suuntanuolet siirtyvät tuuliviivan **päälle**
kuten lähteessä, ja suuntanauha jää pois. Nuoli on siellä `--ink`
paperinvärisellä ääriviivalla, ei sävytetty: täytön päällä sävyramppi
katoaa (sama mittaus kuin viivoilla, pohja 1,14:1).

Mitattu vaakaruudulla: 32,3 px/tunti 24 h jaksolla ja **129 px/tunti
6 h jaksolla** — jälkimmäinen on lähdekuvan luokkaa (190). Laajennus ei
siis tee 7 vrk:sta Windgurua, se tekee 6 h:sta.

### Pystylaajennus ostaa korkeutta

Ensimmäinen versio käytti vaaka-asua kaikkialla, ja mitattuna se antoi
pystyssä **373×145 px — pienemmän kuin kortti itse** (375×209).
Laajennusnappi ei saa tehdä kuvaajasta pienempää kuin se oli.

Pystyssä leveyttä ei voi ostaa, joten laajennus ostaa korkeutta:
373×543 px, eli piirtoalue kolminkertaistuu pystysuunnassa. Aikatiheys
pysyy kortin tasolla, mutta puuska, keskituuli ja tyyni erottuvat
toisistaan silloinkin kun ne ovat lähellä.

**Asu valitaan laatikon MUODOSTA, ei media querystä**: työpöydän kapea
ikkuna ja puhelimen vaaka ovat sama tilanne, ja media query vastaisi
niihin eri tavalla.

### Nappi ja kääntö

Nappi on ensisijainen ja ainoa pakollinen tie — se on löydettävissä ja
näppäimistöllä tavoitettava, ja se on oikea `<button>`. Kääntö on
oikotie: kortin ollessa auki vaakaan kääntäminen laajentaa.

**Pystyyn palaaminen sulkee vain jos näkymä avattiin kääntämällä.**
Napista avattu jää auki ja vaihtaa pystyasuun, koska käyttäjä pyysi sen
nimenomaan. Työpöydällä kääntöä ei ole (ruutu on aina vaaka), joten
oikotie ei laukea vahingossa.

Näkymä kulkee `Modaali`-moduulin kautta: fokusansa, Esc ja paluufokus
tulevat sieltä. Esc sulkee laajan näkymän eikä korttia sen alta.

### Sivutuote: selite lupasi käyrän jota ei ollut

Laajaa mitatessa löytyi vanha vika. "Tyyni"-katkoviivan etäisyys
keskituulesta oli **tasan 0,00 yksikköä** sekä 6 h että 24 h jaksolla —
se piirtyi täsmälleen keskituulen alle.

Syy on `_havNiputa`ssa: `wsMin` ei ole lähteen mittaama tyyni vaan
NIPUN sisäinen minimi. Kun nippuun osuu yksi ainoa näyte, minimi on
sama luku kuin keskiarvo. Laajassa piirtoalue on leveämpi kuin
näytteitä on, joten niputusta ei tapahdu lainkaan — eikä 6 h jaksolla
kortillakaan.

Käyrä piirretään nyt vain jos se erkanee keskituulesta, ja selitteen
avain seuraa samaa ehtoa. Ero tarkistetaan datasta eikä nipun koosta:
niputussääntö voi muuttua, mutta "erkaneeko käyrä" pysyy oikeana
kysymyksenä.

Mitattu jälkeen kortilla: 6 h ei käyrää eikä avainta, 24 h / 3 vrk /
7 vrk käyrä erkanee 1,36 / 6,38 / 7,04 yksikköä ja avain on mukana.
Käyrä ja selite ovat joka jaksolla samaa mieltä.

## Laajennettu kaavio iPhonella: turva-alueet, liuku ja lukemarivi

Käyttäjä raportoi että iPhone 16:lla sulkunappi on kamerapalkin takana
ja että vaakatila ei toimi kunnolla. Mittasin iPhone 16:n mitoilla ja
turva-alueilla (pysty t59/b34, vaaka b21/l59/r59), ja vika oli yksi
mutta oireita neljä:

| | mitattu | turva-alue |
|---|---|---|
| pysty: sulkunappi ylhäältä | 7 px | 59 px |
| vaaka: kaavio vasemmalta | 10 px | 59 px |
| vaaka: sulkunappi oikealta | 12 px | 59 px |
| vaaka: rako alas | 18 px | 21 px |

Näkymä on `position: fixed; inset: 0`, eli se ulottuu kamerapalkin ja
koti-indikaattorin alle, eikä se käyttänyt sovelluksen omia
`--sat/--sab/--sal/--sar`-tokeneita lainkaan. Vaakatilassa "ei toimi
kunnolla" oli siis kolme päällekkäistä oiretta samasta syystä.

Täyte on `max(var(--sat), 6px)` eikä pelkkä token: selaimessa alainsetti
on iPhonella nolla (Safarin oma palkki vie tilan), ja silloin tarvitaan
silti pieni oma marginaali. Vaakatilassa palkki on toisella sivulla,
mutta kumpi sivu se on riippuu kääntösuunnasta — siksi molemmat.

Mitattu jälkeen: sulkunappi 79 px ylhäältä, kaavio 63 px vasemmalta,
nappi 71 px oikealta, rako alas 23 px. Kaikki turva-alueiden ulkopuolella.

### Korkeus sovitetaan laatikkoon

SVG skaalautuu leveyden mukaan ja sen korkeus tulee viewBoxin
kuvasuhteesta, joten kiinteä korkeus jätti ruudusta osan käyttämättä:
mitattuna pystyssä 532 px kun tilaa oli ~660, eli **128 px tyhjää**.
Nyt viewBoxin korkeus ratkaistaan laatikosta, ja kaavio on 646 px.

Takaisinkytkentää ei synny, koska `.hl-kaavio` on `flex: 1` ja
`overflow: hidden` — sisällön korkeus ei muuta laatikon korkeutta.

Kaksi ansaa löytyi mittaamalla:

- **Lukemarivi on täytettävä ENNEN mittausta.** Rivin korkeus riippuu
  siitä montako riviä teksti vie, ja `_asu()` mittaa juuri sen laatikon
  johon rivi vaikuttaa. Kun rivi täytettiin vasta piirron jälkeen, sama
  näkymä antoi peräkkäin 645 px ja 625 px.
- **Kääntämällä avattaessa mitat eivät ole vielä asettuneet.**
  `matchMedia`-tapahtuma ehtii ennen kuin selain on asettanut uudet
  ikkunamitat, ja resize-kuuntelija ehti ajaa näkymän ollessa vielä
  kiinni. Kaavio jäi vaakaan 714×187 px kun asettuneena se on 714×280.
  Ratkaisu on uusintapiirto 180 ms:n kuluttua avauksesta.

**Sivutäyte on 4 px eikä 10 px**, koska kortin kaavio vuotaa 22 px omaan
täytteeseensä (`margin-left:-22px`): leveämpi täyte teki laajennetusta
kaaviosta kapeamman kuin se oli kortilla (365 px vs 375 px). Laajennus
ei saa kaventaa mitään.

### Liu'utus pois

Kahva ylhäällä, ja ele alkaa **vain kahvasta tai otsikkoriviltä**.
Kuvaajan päällä raahaus on lukeman haku, joten sulkuele ei saa alkaa
sieltä — muuten arvon lukeminen sulkisi näkymän. Sama työnjako kuin
korttiarkilla: kahva sulkee, sisältö toimii.

Raja on 90 px tai 0,45 px/ms: nopea heitto sulkee lyhyemmälläkin
matkalla. Näkymä seuraa sormea ja haalenee (opacity 1 → 0,35), ja
lyhyt veto palauttaa sen paikalleen.

Mitattu: 40 px:n veto ei sulje, 160 px sulkee, kuvaajan raahaus ei
sulje, jaksonapin painallus ei sulje (napit ohitetaan `closest('button')`
-tarkistuksella).

### Lukemarivi — kokonäytön paras datalisä

Kelluva kupla jää kokonäytössä täsmälleen sormen alle, juuri sen luvun
päälle jota luetaan. Laajassa näkymässä lukema menee siksi kiinteälle
riville otsikon alle.

Rivillä on kaksi tilaa:

- **Levossa jakson tilastot**: keskituuli, kovin puuska, puuskaisuus,
  tyynin, vallitseva suunta, lämpötilaväli. Kokonäyttöön siirtyminen ei
  saa hävittää sitä yhteenvetoa joka kortilla oli ruusun vieressä.
- **Raahatessa osoitetun hetken arvot**: päivä, kello, tuuli, puuska,
  suunta, lämpötila.

**Puuskaisuus** (kovin puuska / keskituuli) on johdettu luku, ei uusi
mittaus — mutta juuri se vastaa kysymykseen jota foilaaja sarjasta
kysyy: oliko tasaista vai repivää. Kaaviosta sen näkee täytön
paksuutena, mutta lukuna sitä ei ollut missään.

**Lämpötila on VÄLI eikä käyrä.** Oma y-akseli tuulen rinnalla tekisi
risteämisistä merkitseviä vaikka ne ovat mittayksikön sattumaa; väli
(esim. 15,2–16,8 °C) kertoo saman ilman toista asteikkoa. Jos ero on
alle 0,15 °C, näytetään yksi luku.
