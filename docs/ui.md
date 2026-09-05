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
