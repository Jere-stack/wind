# Spottikortti ammattitasolle — strategia

Pyyntö (26.9.2026): *"Lähdetään tekemään spottikortista ammattimaisempi.
Tee kattava strategia jokaisen elementin parantamisesta jotta saadaan
ammattimaisempi näkymä iPhonelle, iPadille ja työpöytänäkymään.
Tärkeimpänä elementtinä näen että tuulihavainnoista tehdään samanlainen
kuin esim. Windgurussa selkeine väreineen ja tietoineen (liitetty kuva) —
tärkeää olisi joko yksi paras saatavilla oleva tuuliennuste ja jatkaa
sitä muilla datalähteillä jos se loppuu, ja selkeä valikko josta valita
malli ja tarvittaessa useampia ennustemalleja allekkaisiin graafeihin tai
samaan graafiin. Huomioi tyyli, esim. sulkijanapit ja niiden toimivuus
koko apin läpi samanlaiseksi. Tee ensin selkeät ohjeet/strategia, ja minä
päätän tehdäänkö kaikki vaiheet."*

**Tila:** toteutettu kokonaan (V0–V7). Käyttäjän päätös 26.9.:
"tehdään kaikki vaiheet, suositukset käyvät kaikkiin P-kohtiin".
Strategia on alla sellaisenaan päätöksen pohjana; mitä tehtiin ja
mitattiin, ja missä toteutus poikkesi strategiasta, on osiossa
**7. Toteutus ja mittaukset**. Jatkopyyntö 27.9. (yhtenäistys: ei
jaksovalitsimia, pehmeä tunnin siirto, Nyt-nappi, kaikki kaaviot samalla
moottorilla, kortti moduuleiksi, havaintoasemakortit samaan tyyliin,
fontit ja sulkunappi) on osioissa **V8** ja **V9** luvussa 7.

**Uusi strategia 3.10.2026: luku 8, "Rauhallinen ja vakaa kortti"**
(mallilukemat näkyviin laajassa, ei koon muutoksia, kahdennukset pois).
Käyttäjän päätös 3.10.: kaikki suosituksen mukaan, paitsi että kupla
jää kaavioihin (P11). Toteutus vaiheittain V12–V16 ja mittaukset
luvussa **8.10**.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä.
> Lue myös `docs/ui.md` (spottikortti, havaintokaavio, laaja näkymä,
> valikot) ja `docs/mallit.md` (mallit ja niiden sekoitus) ennen kuin
> toteutat mitään tästä.

---

## 1. Tiivistelmä

1. **Kuvan kaavio on ennustekaavio (meteogrammi), ja sama kaavion kieli
   tulee sekä ennusteeseen että havaintoon.** Pyynnössä sanotaan
   "tuulihavainnoista", mutta kuva on ennuste (tulevat tunnit, suunta-
   nuolet, puuskat). Tulkitsen pyynnön niin, että *sama piirtomoottori ja
   sama ulkoasu* tulee kortin molempiin tuulikaavioihin: ennuste ensin
   (se on se jonka perusteella lähdetään), havainto samaan asuun heti
   perään. Näin kortissa ei ole kahta eri näköistä tuulikaaviota.

2. **Suurin yksittäinen ammattimaisuusvika ei ole ulkoasu vaan se, että
   kortti ja kartta näyttävät eri lukua.** Kartta ja aikajana lukevat
   "Paras saatavilla" -sekoitusta (FMI > MET Nordic > ECMWF 9 km >
   ECMWF), kortti omaa sarjaansa (HARMONIE ~60 h → Open-Meteo
   `best_match`). Mitattu ero on keskimäärin 1,38 m/s ja 86 % tunneista
   yli 0,5 m/s (CLAUDE.md, *Kenttä ja data*). Ammattityökalussa samalle
   tunnille samassa paikassa on yksi luku. Strategia tekee kortin
   pääsarjasta **saman sekoituksen kuin kartalla** ja näyttää saumat
   näkyvinä lähdekaistoina.

3. **Mallivalikko on kortin oma, ja sillä on kaksi asua:** *päällekkäin*
   (yksi kaavio, pääsarja täytettynä ja vertailumallit viivoina — kuten
   nyt, mutta suunnalla ja puuskalla) ja *allekkain* (Windgurun tapaan
   yksi matala kaavio per malli, yhteinen aika-akseli ja yhteinen
   osoitin). Vertailumallit tulevat samasta lähteestä kuin kartan
   pakotettu malli (`/api/malli?tila=sarja`), joten "ICON kortissa" on
   pikselilleen sama ICON kuin kartalla.

4. **Kortin rakenne siivotaan kolmeksi päätöskerrokseksi:** *nyt ja
   valittu hetki* (hero), *ennuste* (kaavio + mallit), *vesi ja havainto*.
   Tunti valitaan kaaviosta tai aikajanasta — erillinen tuntivalitsin
   (`#sh-timepill`) on kolmas tapa tehdä sama asia.

5. **Viimeisenä yhtenäinen komponenttikirjasto koko sovellukseen:**
   yksi ikoninappi (sulje / laajenna / tähti / jaa), yksi segmentti-
   valitsin (jakso, malli, asu), yksi osion otsikko, yksi välistys.
   Sulkunappi on jo yhtenäistetty neljään paneeliin (`.paneeli-sulje`);
   jäljellä on laaja näkymä (`#hl-sulje` on `.hav-nappi`), toastit ja
   kortin sisäiset inline-tyylit.

---

## 2. Nykytila — kortin elementit järjestyksessä

Kartoitettu koodista (`openSheet`, `index.html` ~r. 15931–17700). Korkeus
oli viimeksi mitattuna 1 086 px puhelimella (docs/ui.md, *Spottikortin
auditointi*).

| # | elementti | koodi | havainto |
|---|---|---|---|
| 1 | Yläpalkki + X | `.paneeli-yla`, `#sheet-sulje` | Yhtenäistetty edellisessä erässä. Kunnossa. |
| 2 | Nimi, tähti, jako, kuvaus | `.sh-name-rivi`, `.sh-desc` | Kunnossa. Kuvaus vie rivin joka kerta, vaikka sitä luetaan kerran. |
| 3 | Spottiindeksi (64 px rengas) + selite + erittely + hajontarivi | inline `style=` ×6 | Neljä tekstikokoa (fs-9/10/11) ja kolme väriä yhdessä lohkossa. Hajontarivi ilmestyy myöhässä ja siirtää heroa. |
| 4 | Iso lukema, puuska, puuskaisuus ×1,4 | `.sh-big-*` | Puuskaisuuden värit (`#2A702D`, `#8A5A00`, `#A3271C`) ovat kolme omaa väriä joita ei ole muualla. Suuntaa ei ole herossa lainkaan. |
| 5 | Tuntivalitsin nuolilla | `#sh-timepill` | Kolmas tuntivalitsin (aikajana, päiväkisko, tämä). Rakentaa *koko* akselin (~400 lappua) joka `openSheet`issa. |
| 6 | Foil-merkki | `.sh-foil-badge` | Irrallaan omalla rivillään, vaikka se on sama päätös kuin indeksi. |
| 7 | **Tuuliennustekaavio** | `build24hChart` | 120 yksikköä korkea viiva, rampin gradientti viivassa, vertailumallit katkoviivoina (vain nopeus), valo- ja sadekaista, FMI-raja, foilausraja, 24 h / 5 vrk / Kaikki, laajennus. **Ei suuntaa, puuska vain työkaluvihjeessä, ei lukuja kaaviossa.** |
| 8 | Aurinkorivi | `buildSunRivi` | Kunnossa, mutta irrallaan kaaviosta jonka valokaistaa se selittää. |
| 9 | Aaltoennuste, poiju, vedenkorkeus | `buildAalto*`, `buildVesiRivi` | Kolme yhden rivin lohkoa, kukin oma muotonsa. |
| 10 | "Havainnot" + 4 ruutua (tuuli, vesi, puku, FMI-linkki) | `.sh-stat` | Otsikko on fs-8/700/uppercase, alempana fs-10/600 ja fs-9 — kolme otsikkotyyliä kortissa. |
| 11 | Tuulihavaintokaavio | `#…-hist`, `HAV_ASU_*` | Värit korkeudesta (`paperi()`), kolme asua, laajennus. Hyvä pohja, mutta eri kieli kuin ennustekaaviolla. |
| 12 | Osuvuus | `.sh-osuvuus` | Hyvä tieto väärässä paikassa: se kertoo ennusteen luotettavuudesta ja kuuluu ennusteen viereen. |
| 13 | Vedenlämpökaavio (UiRas) | `uiras-always-…` | Kolmas kaavio, kolmas asu. |
| 14 | Navigointinapit | `buildNavButtons` | Inline-tyylit. |

**Yhteenveto viasta:** yksittäiset osat on mitattu ja korjattu hyvin,
mutta kortti on kasvanut *lohko kerrallaan*. Samaa päätöstä ("lähdenkö")
kannattaa nyt kolme erillistä elementtiä (indeksi, foil-merkki,
hajonta), samaa aikaa valitsee kolme ohjainta, ja tuulta piirtää kaksi
eri kaaviokieltä. Ammattimaisuus tulee tässä vähentämällä, ei lisäämällä.

---

## 3. Tavoitekuva

### 3.1 Tuulikaavio (kuvan malli)

Kuvan kaavion tunnistettavat osat, ja miten ne istuvat sovelluksen
lukittuihin sääntöihin:

| kuvassa | FoilSpotissa | sääntö johon osuu |
|---|---|---|
| Päiväotsikko ("La 26.9.") ja tuntirivi 3 h välein | Sama, 3 h lukemat ja päiväraja hiusviivana | Aikajanan päiväraja on hiusviiva, ei elementti — sama tähän. |
| Yö varjostettuna sarakkeena | Nykyinen valokaista (`VALO_VARIT`) → vaihtoehtoisesti yöharso koko korkeudelle | `VALO_VARIT` on kaavion omaisuutta; aikajanaan ei palaa. Havaintokaavion yöharso .13/.09/.05 on jo kalibroitu — käytetään samaa. |
| Tuulialue täytettynä, väri korkeudesta | Täyttö korkeuden funktiona, `gradientUnits="userSpaceOnUse"` | Sama tekniikka kuin havaintokaaviossa. **Värin voimakkuus on P1.** |
| Paksu musta viiva tuulen päällä | `--ink`, 2·LW | Havaintokaavion sääntö: viivat `--ink`, ei ramppia. |
| Puuska vaaleampana alueena yläpuolella | Puuskavyöhyke tuulen ja puuskan välissä, puolet täytön alfasta, ei reunaviivaa | Aikajanan puuskahuntu poistettiin *aikajanasta*; kortin kaaviossa puuska on juuri se paikka johon se siirrettiin. |
| Luvut viivan päällä (tuuli musta, puuska harmaa) | Joka 3. tunti (24 h) / 6. tunti (5 vrk), törmäyksenesto | Kovin puuska saa aina lapun (havaintokaavion sääntö). |
| Suuntanuolet joka tunti | Oma nuolirivi kaavion alla, ei viivalla | Nuoli osoittaa MIHIN tuulee (`rotate(dir+180)`) kuten kapselissa. Viivalla nuolet törmäävät lukuihin (kuvassa näkyy juuri tämä). |
| — | **Nuolen täyttö kertoo sopiiko suunta spotille** (`spot.bestDirs`): umpi = sopii, ontto = ei | Uusi. Väri on varattu nopeudelle, joten tieto kulkee muodossa. |
| Vaakaviivat 5 m/s välein | Tikit näyttöyksikössä, tiheys pikseleistä (16·FS) | Olemassa oleva sääntö. |
| — | Foilausraja 6 m/s `#9C8447` 1,5·LW | Olemassa oleva sääntö. |
| — | NYT-viiva ja valitun tunnin osoitin | Valittu tunti on `State.valittuMs` — kaavio ja aikajana näyttävät saman hetken. |
| — | **Lähdekaista** ylälaidassa: "HARMONIE 2,5 km · ECMWF 9 km", sauma pehmeänä liukuna | Korvaa nykyisen "FMI päättyy" -rajan (lappu säilyy rajan vasemmalla). |

Kaavion alle kaksi valinnaista matalaa riviä (Windgurun rivit):
**lämpötila** (lukuina, ei käyränä — sääntö: lämpötila ei saa omaa
y-akselia tuulen rinnalle) ja **sade mm/h** (nykyinen sadekaista
pylväiksi). Valinnaisuus on P6.

### 3.2 Yksi paras sarja, jatkettuna muilla

"Paras saatavilla" pisteessä on sama sääntö kuin kartalla
(`Saalaatat.PERHEET`, docs/mallit.md V3):

```
FMI HARMONIE 2,5 km   /api/harmonie        ~ −2 … +60–66 h, tunneittain, tuuli+suunta+puuska+lämpö+pilvet
MET Nordic 1 km       varasto n0            −48 h … + tuorein ajo (menneisyys + lyhyt ennuste)
ECMWF 9 km            /api/malli?tila=sarja +15 vrk, tunneittain lähellä, puuska mukana
ECMWF (varasto)       varasto l0–l4         aina — pohja jota ei saa puuttua
```

- **Sekoitus kuten kartalla:** paino ajassa smoothstep akselin alussa
  2 h ja lopussa 6 h, nopeus keskiarvona ja suunta yksikkövektoreista.
  Ei kovaa saumaa: HARMONIE liukuu ECMWF:ään kuuden tunnin matkalla.
  Paikkapainoa ei tarvita, koska spotti on yksi piste (paino on joko
  0 tai 1 ellei spotti ole alueen reunalla).
- **Puuska tulee vain sarjoista joissa se on tunnin puuska** (HARMONIE,
  ECMWF 9 km). Varaston puuska ei kelpaa (joka toinen askel on tuuli).
- **Lähdekaista** kertoo kenen luku kullakin tunnilla on, ja
  työkaluvihje nimeää tunnin lähteen (`Lahde.LYHYET` — ainoa
  nimirekisteri).
- **Aikajana ja kortti näyttävät samaa lukua** kun kartan keskipiste on
  spotissa. Tämä on hyväksymistesti: ero ≤ 0,05 m/s kaikilla tunneilla.
- Kapselin puuska lukee `_puuskaPiste`ä; kortti ja kapseli saavat
  saman puuskan kun sama sarja on molemmilla.

**Tämä koskee lukittua sääntöä** ("Kumpi taso on tarkempi EI OLE
RATKAISTU"). Valinta tehdään yhtenäisyyden perusteella, kuten aikajanan
kohdalla aikanaan (`aikajananLahde`), ei tarkkuuden. Päätös on P2.

### 3.3 Mallivalikko

Kortin ennusteosion yläpalkki:

```
Tuuliennuste                         [24 h | 3 vrk | 7 vrk | Kaikki]  [⤢]
[● Paras] [HARMONIE] [MET Nordic] [ECMWF] [ICON] [GFS]    [Päällekkäin | Allekkain]
```

- **Sirut ovat monivalinta**, ensimmäinen ("Paras") on pääsarja ja aina
  päällä. Muut ovat vertailuja. Sama siru- ja radiogroup-kieli kuin
  asetuspaneelissa, mutta `role="group"` + `aria-pressed`, koska
  monivalinta ei ole radiogroup.
- **Päällekkäin**: pääsarja täytettynä (3.1), vertailut ohuina viivoina
  omilla väreillään ja katkoviivakuvioillaan (`MALLI_VIIVA`,
  dikromaattiturvallinen pari jo mitattu). Enintään kolme vertailua
  näkyy kerralla; neljäs sammuttaa vanhimman. Mallien hajonta
  (`mallienHajonta`) lasketaan valituista.
- **Allekkain**: jokainen valittu malli omana matalana kaavionaan
  (puhelimella 96 px, laajassa 140 px), sama täyttö, sama aika-akseli,
  yhteinen osoitin joka liikkuu kaikissa kerralla. Pääsarja ylimpänä.
  Windgurun "vertaa malleja" -näkymä.
- **Malli on saatavilla vain jaksollaan.** HARMONIE loppuu ~60 h:ssa,
  ICON-EU 120 h:ssa (ICON-globaali jatkaa). Jakson ulkopuolella viiva
  loppuu näkyvästi ja lappu kertoo "HARMONIE päättyy" — ei jatketa
  toisella mallilla hiljaa, koska vertailun pointti on nähdä malli
  itse. (Pääsarja on ainoa joka jatkuu.)
- **Data:** ECMWF 9 km, ICON ja GFS tulevat `/api/malli?tila=sarja`:sta
  (oma S3-luku, ei kiintiötä, tuuli+suunta+puuska, sama data kuin kartan
  pakotus). MET Nordic ja HARMONIE ovat pääsarjan osina jo haettuja.
  Nykyinen Open-Meteo-vertailupyyntö (`models=ecmwf_ifs025,icon_eu,
  gfs_seamless`, vain nopeus) poistuu — se on eri ECMWF (0,25°) kuin
  kartan 9 km ja siksi eri luku samalle mallinimelle.
- **Haku vain valituille.** Suljettu siru ei maksa pyyntöä. Valinta
  muistetaan (P4), jolloin tavallinen avaus maksaa saman kuin nyt.
- **Kartan mallivalinta ja kortti:** P3.

### 3.4 Kortin rakenne

```
┌ yläpalkki: nimi ★ ⇪                                     ✕ ┐
│ HERO  valittu hetki                                       │
│   12,4 kts ↗ lounaasta · puuska 17 · ×1,4                 │
│   [indeksirengas] Hyvä — sopiva suunta · Mallit yksimielisiä │
│   Ma 28.9. klo 15 · HARMONIE 2,5 km                       │
├ ENNUSTE                                                   │
│   mallivalikko (3.3)                                      │
│   tuulikaavio (3.1)                                       │
│   aurinko: 07:12–19:04 · 11 h 52 min · hämärä 19:48 asti  │
│   osuvuus: "tällä spotilla ennuste on ollut 1,2 kts liian kova" │
├ HAVAINTO  Espoo Haukilahti · 3 km · 4 min sitten          │
│   iso lukema + havaintokaavio samassa kaaviokielessä      │
├ VESI                                                      │
│   ruudukko: vesi °C · puku · aalto (ennuste) · poiju (nyt) · vedenkorkeus │
│   vedenlämpökaavio (UiRas)                                │
└ NAVIGOINTI  Google Maps · Waze                            ┘
```

- **Hero sanoo päätöksen kerran.** Foil-merkki, indeksiselite ja
  hajontarivi yhdistyvät yhdeksi lauseriviksi renkaan viereen. Suunta
  tulee heroon (nuoli + nimi ablatiivissa, `fs_suuntamuoto`).
  Hajontarivin paikka varataan heti (min-height), jotta hero ei hypi
  kun vertailudata saapuu.
- **Aikarivi** ("Ma 28.9. klo 15 · lähde") korvaa tuntivalitsimen.
  Tunti valitaan kaaviota napauttamalla/raahaamalla (valinta kulkee
  `_tlValitseIdx`/`_tlSeuraaHetkea`-polkua, ei omaa) tai aikajanasta.
  Tuntivalitsimen poisto on P5.
- **Osioiden otsikot** yhdellä komponentilla (`.sh-osio`: 11 px/700,
  `--ink-3`, versaali, hiusviiva perässä). Nyt kolme eri tyyliä.
- **Kaikki inline-tyylit luokiksi.** Kortissa on kymmeniä `style=`-
  attribuutteja; ne ovat syy siihen että sama asia näyttää eri
  kohdissa eri tavalla.
- **Puuskaisuuden omat värit** (`#2A702D` / `#8A5A00` / `#A3271C`)
  korvataan musteella + `--accent` vain "erittäin puuskainen" -tasolla
  (se on varoitus, eli juuri se mihin magenta on varattu).

### 3.5 Laitekohtaiset asut

Raja on LEVEYS, ei syöttölaite (sääntö `sivupaneelit()`).

| | iPhone (< 740 px) | iPad (≥ 740, kosketus) | työpöytä |
|---|---|---|---|
| kortti | pohjalevy, täysi leveys | sivupaneeli 400 px | sivupaneeli 400 px |
| kaavio kortissa | reunasta reunaan (vuotaa kortin täytteeseen), 200 px + nuolirivi | sama kuin puhelin | sama + hover-lukema |
| tunnin valinta | napautus/raahaus kaaviossa, lukema kiinteällä rivillä kaavion yllä | sama | hover näyttää, klikkaus valitsee; `,` `.` askeltavat |
| jaksot | 24 h täysi leveys; 3 vrk ja 7 vrk vaakaveto ajassa (kuten laaja nyt) | sama | sama + rulla vaakasuunnassa |
| laajennus | vaakaan kääntö → `HavLaaja` | nappi → `HavLaaja` koko ruudulle | nappi → `HavLaaja` modaalina, 90 vw × 80 vh |
| allekkain-asu | 96 px/malli, max 4 mallia ennen vieritystä | 110 px | laajassa 140 px |

- **Kiinteä lukemarivi myös kortissa.** Kortissa lukema kelluu nyt
  laatikossa osoittimen vieressä (mitattu 0/4 pallon peittoa). Kun
  malleja on allekkain neljä, kelluvia laatikoita olisi neljä; yksi
  rivi kaavion yllä ("15:00 · Paras 12,4 ↗ · ICON 11,8 · GFS 13,1")
  kertoo kaikki. Sama ratkaisu kuin laajassa jo on.
- **Leveämpi sivupaneeli iPadilla/työpöydällä** (esim. 480 px) antaisi
  kaaviolle 20 % lisää tilaa, mutta rikkoo säännön "kaikki kolme
  paneelia sama 400 px". Ei ehdoteta; laajennus hoitaa ison kuvan.

### 3.6 Yhtenäinen tyyli koko sovellukseen (viimeinen vaihe)

Kirjataan komponentteina, ei yksittäisinä korjauksina:

| komponentti | nyt | tavoite |
|---|---|---|
| Sulkunappi | `.paneeli-sulje` 4 paneelissa; laajassa `.hav-nappi#hl-sulje`; toasteissa ei nappia | `.paneeli-sulje` kaikkialla missä jokin sulkeutuu, myös laaja näkymä. Yksi SVG-lähde (`_SULJE_SVG`), nyt kopioituna HTML:ään neljästi. |
| Ikoninappi | `.hav-nappi`, `.sh-ikoni`, `.paneeli-sulje` — kolme luokkaa samalle 30 px ympyrälle | Yksi `.ikoninappi` (30 px ympyrä, 44 px osumapinta napilta itseltään), muunnelmat modifikaattoreina. |
| Segmenttivalitsin | kaavion jaksonapit `[data-cp]`, asetusten sirut, vedenlämmön jaksot | Yksi `.segmentti` (radiogroup, vaeltava tabindex, valinta seuraa fokusta) — asetusten koneisto on jo olemassa, se laajennetaan. |
| Osion otsikko | 3 tyyliä kortissa, 1 asetuksissa | `.osio-otsikko` kaikkialla. |
| Välistys | vapaita pikseliarvoja | Tokenit `--v-1…--v-6` (4/8/12/16/24/32). |
| Numerot | osin `tabular-nums` inline | `tabular-nums` kaikille lukemille luokan kautta. |
| Esc, sarkain, fokus | `Modaali`-moduuli | Uudet pinnat (mallivalikko ei ole pinta; laaja on jo) — ei viidettä polkua. |

Mittari (`tools/`-skripti, ei tuotantoon): jokaisesta pinnasta
fonttiperheet, sulkunapin sijainti paneelin kulmasta, osumapinnat
napauttamalla (ei `getBoundingClientRect`illä), ja inline-`style`-
attribuuttien määrä kortissa ennen/jälkeen.

---

## 4. Päätettävät kohdat

**P1 — Kaavion värien voimakkuus.** Sääntö nyt: havaintokaavion täyttö
on `paperi()` (ramppi 0,48 kohti mustaa, jotta viivat ja luvut erottuvat
paperilla). Kuvan kaavio käyttää kylläistä ramppia valkoisella.
- **A (suositus):** kylläisempi täyttö — `ColorRamp.rgb()` alfalla
  noin .70 paperin päällä, luvut ja viiva `--ink`. Mitataan että
  `--ink` on täyttöä vasten ≥ 4,5:1 koko rampin matkalla; jos
  magenta/sininen pää alittaa, luvuille valkoinen 1 px halo. Tämä on
  se "selkeine väreineen" mitä kuva näyttää.
- **B:** pysytään `paperi()`ssä (nykyinen, mitattu, rauhallisempi).
- Kumpi tahansa valitaan, se tulee **molempiin** tuulikaavioihin.

**P2 — Kortin pääsarja = kartan sekoitus.** Hyväksytkö että kortti
lakkaa lukemasta omaa HARMONIE → Open-Meteo -sarjaansa ja lukee samaa
"Paras saatavilla" -sekoitusta kuin kartta ja aikajana (3.2)?
Suositus: kyllä. Seuraus: kortin, kartan ja aikajanan luku samalle
tunnille on sama; Open-Meteon `best_match` poistuu kortista kokonaan.

**P3 — Kartan mallivalinta ja kortti.** Kun kartalla on pakotettu malli
(esim. ICON):
- **A (suositus):** kortin "Paras" pysyy parhaana ja ICON-siru syttyy
  vertailuksi automaattisesti — kartan valinta näkyy kortissa ilman
  että kortin pääsarja vaihtuu.
- **B:** kortin pääsarja seuraa kartan valintaa (ICON täytettynä).
- **C:** toisistaan riippumattomat.

**P4 — Muistetaanko kortin vertailuvalinta?** Kartan mallivalintaa ei
tallenneta (käyttäjän päätös). Kortin vertailumallit ovat näyttötapa,
eivät "huonompi malli ilman muistutusta", joten suositus on **muistaa**
(valitut sirut ja päällekkäin/allekkain) — mutta päätös on sinun, koska
se on sama kysymys toisessa paikassa.

**P5 — Tuntivalitsimen (`#sh-timepill`) poisto.** Puhelimella pohjalevy
peittää aikajanan, ja tuntivalitsin on silloin ainoa näkyvä tapa
vaihtaa tuntia. Korvaaja on kaavion napautus/raahaus + aikarivi herossa.
Suositus: poista, kun kaavion valinta on mitattu toimivaksi
laitteella (WebKit-asetelma, värisevä napautus).

**P6 — Lämpötila- ja sadeallekkaisrivit kaavion alla.** Windgurun rivit
lisäävät noin 36 px. Suositus: sade kyllä (nykyinen kaista pylväiksi),
lämpötila vain laajassa näkymässä.

**P7 — Oletusjakso.** Nyt 24 h. Kuvassa ~40 h. Suositus: **48 h
täysi leveys puhelimella**, 3 h lukemat (16 lukemaa mahtuu 393 px:lle
~24 px välein). 7 vrk ja "Kaikki" vaakavedolla ajassa.

**P8 — Taulukkoasu (valinnainen lisävaihe).** Windgurun tunnetuin muoto
on värisolutaulukko (rivi per suure, sarake per tunti). Se on kolmas
asu samalle datalle; ehdotan sitä vasta V3:n jälkeen ja vain jos
allekkain-kaavio ei riitä vertailuun.

**P9 — Havaintokaavion ennustevertailu.** Havaintokaavioon voi piirtää
saman tunnin pääsarjan katkoviivana ("ennuste vs toteutunut"). Osuvuus-
rivi kertoo tämän nyt numeroina. Suositus: kyllä, V5:ssä.

---

## 5. Vaiheet

Jokainen vaihe on oma committinsa ja viedään oletushaaralle
(`claude/vite-project-setup-6je1pq`) vasta kun sen mittaukset ovat
kunnossa. Jokainen vaihe päivittää `docs/ui.md`:n / tämän tiedoston
mittauksineen ja CLAUDE.md:n säännöt jos lukittua sääntöä muutetaan.

### V0 — Mittauspohja (ei näkyvää muutosta)

- Harness `spottikortti.mjs`: iPhone 393×852, iPad pysty 820 ja vaaka
  1180, työpöytä 1440; WebKit + tuotantobuild + `hasTouch`,
  `timezoneId: 'Europe/Helsinki'`, `serviceWorkers: 'block'`.
  Kortti avataan `openSheet`illa (kosketussäätö osuu naapurimerkkiin).
- Mitataan: kortin korkeus osittain, inline-tyylien määrä, fonttien
  määrä, kaavion piirtoalue, lukemien kontrasti, kortin ja aikajanan
  lukuero spotissa 48 tunnille (lähtötaso P2:lle).
- Mallidata istutetaan välimuistiin (`spot._modelCache` / uusi vastine),
  ei haeta verkosta (sääntö).
- **Koko:** pieni. **Riski:** ei.

### V1 — Uusi tuulikaavio nykyisellä datalla

- Uusi piirtofunktio `tuuliKaavio(sarjat, asu, jakso)` (yksi funktio,
  asut taulukossa kuten `HAV_ASU_*` — ei laajalle omaa).
- Kaikki 3.1:n kerrokset: täyttö korkeudesta, puuskavyöhyke, `--ink`-
  viiva, luvut, nuolirivi + suunnan sopivuus, päiväotsikko, yöharso,
  foilausraja, NYT ja valittu tunti, kiinteä lukemarivi.
- Data yhä nykyinen (HARMONIE → Open-Meteo), mutta suunta ja puuska
  otetaan `spot.wx.hourly`sta, jossa ne jo ovat.
- `HavLaaja` käyttää uutta funktiota (lähteenä sama `piirra`).
- **Mitataan:** lukemien peitto (0 törmäystä), kontrasti (P1),
  nuolten suunta 8 ilmansuuntaan tunnettua sarjaa vasten, piirtoaika
  < 8 ms/kaavio puhelinasussa, laajennus ei kavenna mitään.
- **Koko:** suuri. **Riski:** keskitaso — kaavio on kortin isoin osa.

### V2 — Paras saatavilla -sarja korttiin (P2)

- `pisteenParasSarja(lat, lng)` yhdistää HARMONIEn, MET Nordicin
  (varasto, `wxTunneittain` pisteessä), ECMWF 9 km:n (`/api/malli
  ?tila=sarja&malli=ecmwf`) ja varaston ECMWF:n kartan painoilla.
- Lähdekaista ja työkaluvihjeen lähde `Lahde.LYHYET`istä.
- Open-Meteo `best_match` pois kortista.
- **Mitataan:** kortti vs aikajana spotissa ≤ 0,05 m/s kaikilla
  tunneilla; sauman hyppy (vierekkäisten tuntien ero rajalla vs mallin
  sisällä); avauksen pyyntömäärä ennen/jälkeen; S3-sarjan aikaraja
  (6 s + uusinnat) ei jumita korttia — kaavio piirtyy ensin
  HARMONIElla ja jatke täydentyy.
- **Koko:** keskitaso. **Riski:** keskitaso (kaksi datapolkua
  yhdistyy; `kaytossa()` vs `kartallaKaytossa()` -ero on muistettava).

### V3 — Mallivalikko: päällekkäin ja allekkain

- Sirut + asuvalitsin (3.3), haku vain valituille, `/api/malli`
  sarjana ECMWF/ICON/GFS:lle suunnalla ja puuskalla.
- Yhteinen osoitin allekkaisissa, yksi lukemarivi kaikille.
- `mallienHajonta` valituista malleista.
- P3 ja P4 toteutetaan päätösten mukaan.
- **Mitataan:** pyynnöt vain valituille, kortin ICON = kartan pakotettu
  ICON samassa pisteessä ja tunnissa, jakson loppu näkyy oikeassa
  kohdassa, osoitin samassa x:ssä kaikissa kaavioissa (±0,5 px).
- **Koko:** suuri. **Riski:** keskitaso.

### V4 — Kortin rakenne

- 3.4:n järjestys, hero yhdeksi päätökseksi, aikarivi, osio-otsikot,
  inline-tyylit luokiksi, puuskaisuuden värit.
- Tuntivalitsimen poisto jos P5 = kyllä.
- **Mitataan:** kortin korkeus (tavoite: ensimmäinen ruudullinen
  puhelimella sisältää heron JA koko kaavion), heron hyppy 0 px kun
  vertailudata saapuu, `openSheet`in aika (tuntivalitsimen ~400 lappua
  pois), sarkainjärjestys ja ruudunlukijan nimet.
- **Koko:** keskitaso. **Riski:** pieni.

### V5 — Havaintokaavio samaan kieleen

- Havaintokaavio piirtyy V1:n funktiolla (asu `havainto`: puuska ja
  tuuli mitattuina, minimi katkoviivana kun se erkanee — nykyiset
  säännöt säilyvät), vedenlämpökaavio samoilla akseleilla ja fontilla.
- P9: ennusteen katkoviiva havainnon päälle.
- **Mitataan:** nykyiset havaintokaavion mittaukset uudestaan
  (kovin puuska saa lapun, laajennus 1:1, turva-alueet).
- **Koko:** keskitaso. **Riski:** pieni–keskitaso.

### V6 — Laitekohtaiset asut

- 3.5:n taulukko: hover ja näppäimet työpöydällä, vaakaveto 3/7 vrk,
  iPadin laaja, allekkain-korkeudet.
- **Mitataan:** WebKit-eleasetelmalla (rAF jäädytettynä, `scrollend`
  estettynä, värisevä napautus) — kaavion napautus valitsee tunnin,
  raahaus ei sulje paneelia (`_vaakaEleenOmistaja`), pystyveto vierittää
  korttia.
- **Koko:** keskitaso. **Riski:** keskitaso (eleet).

### V7 — Yhtenäinen tyyli koko sovellukseen

- 3.6:n komponentit: `.ikoninappi`, `.paneeli-sulje` laajaan näkymään,
  `.segmentti`, `.osio-otsikko`, välistystokenit, yksi `_SULJE_SVG`.
- **Mitataan:** sulkunappi samassa pikselissä kaikissa pinnoissa,
  osumapinnat napauttamalla, Arialia 0, inline-tyylien määrä,
  Esc/sarkain kaikissa pinnoissa.
- **Koko:** keskitaso. **Riski:** pieni (mutta koskee kaikkea — tehdään
  viimeisenä kuten pyydettiin).

### Järjestys ja riippuvuudet

```
V0 ─┬─ V1 ─┬─ V2 ─── V3
    │      ├─ V4
    │      └─ V5
    └──────────────── V6 (V1:n jälkeen milloin vain)
                      V7 (viimeisenä)
```

V1 on suurin näkyvä parannus ja toimii yksinäänkin. V2 on suurin
*oikeellisuuden* parannus. V3 on pyynnön mallivalikko ja vaatii V2:n
(pääsarjan pitää olla "Paras" ennen kuin sitä verrataan muihin).

---

## 6. Mitä EI ehdoteta

- **Ei kolmatta kaavion piirtofunktiota.** Ennuste, havainto ja laaja
  ovat saman funktion asuja.
- **Ei värejä muuhun kuin tuulennopeuteen kaaviossa.** Mallit erottuvat
  viivakuviolla ja omilla (jo mitatuilla) viivaväreillään, suunnan
  sopivuus muodolla, lähde tekstillä.
- **Ei minuuttitarkkuutta** (mitattu turhaksi, CLAUDE.md).
- **Ei ensemble-hajontaa** — se ei ole S3-peilissä ja vaatisi uuden
  kiintiön (CLAUDE.md, *Uudet lähteet*).
- **Ei MEPS:iä "toiseksi malliksi"** — se on HARMONIE, ja erimielisyys
  näyttäisi nollaa.
- **Ei aikajanan muutoksia.** Aikajana on mitattu ja lukittu; kortti
  mukautuu siihen (valittu hetki, valintapolut), ei päinvastoin.

---

## 7. Toteutus ja mittaukset

Kaikki mitattu tuotantobuildista (`npm run build` + `vite preview`),
WebKit iPhone-kontekstissa (`hasTouch`, `deviceScaleFactor: 3`,
`Europe/Helsinki`, service worker estetty) ellei toisin sanota. Eleet
Chromiumilla CDP-kosketustapahtumilla (`Input.dispatchTouchEvent`).
Harnessit ovat istunnon työtiedostoja (`lahto.mjs`, `ero2.mjs`,
`napautus.mjs`, `eleet.mjs`, `nappis.mjs`, `merkit.mjs`, `v7.mjs`).

### V0 — lähtötaso

| | ennen |
|---|---|
| kortin korkeus (puhelin, Lauttasaari) | 1 374 px |
| inline-`style`-attribuutteja kortissa | 550 |
| fonttiperheitä kortissa | 1 |
| kortin luku vs aikajana spotissa, 48 h | ka 0,51–0,96 m/s, max 1,75–3,09, 46–73 % tunneista yli 0,5 m/s (5 spottia) |

### V1–V3 — kaavio, Paras ja mallivalikko

Moduulit: `KorttiSarjat` (data), `Tuulikaavio` (piirto, asut
`kortti`/`rivi`/`laaja`), `Ennuste` (osio). Kortin vanha
`build24hChart` (1 200 riviä) on poistettu.

- **Paras = kartan sekoitus.** `wxTunneittain` sai `opts`in (perheet,
  dyn-sarja, pohja, lähteet), ja perheet vaihdetaan tilapäisesti ja
  palautetaan (`_perheetTilapaisesti`). Spotin ECMWF 9 km -sarja tulee
  `MalliHila.pisteenSarja`sta samalla avaimella ja muistilla kuin
  kartan keskipisteen sarja. **Kortti vs aikajana spotissa 48 h:
  0,0000 m/s viidessä spotissa** (ennen 0,51–0,96). Aikajana ei
  muuttunut: mitattu samassa ajossa kortin laskennan jälkeen.
- **Vertailumallit puhtaina**: HARMONIE ja MET Nordic varastosta ilman
  pohjaa ja muita perheitä, ECMWF/ICON/GFS `api/malli`sta (sama data
  kuin kartan pakotus). Sarja loppuu mallin jakson päässä.
- **Napautus valitsee tunnin**: 3/3 (+12 h, +30 h, −2 h), WebKit.
- **Laaja**: sama piirto, asu `laaja`; allekkain ja päällekkäin.
- `api/harmonie` palauttaa nyt sademäärän (`Precipitation1h` /
  `precipitation`) sadepylväitä varten.

**Poikkeamat strategiasta:**
- *Jaksot* ovat 48 h / 7 vrk / Kaikki (strategiassa oli myös 3 vrk).
  Vierivät jaksot käyttävät 48 h:n tiheyttä, joten 3 vrk olisi ollut
  vain lyhyempi 7 vrk.
- *Hajonta* lasketaan edelleen ECMWF/ICON/GFS-kolmikosta, ja ne
  haetaan 1,2 s kortin jälkeen myös valitsematta. Strategiassa
  "suljettu siru ei maksa pyyntöä" — mutta ilman niitä herosta olisi
  kadonnut mallien yksimielisyys. Hinta on kolme `api/malli`-kutsua
  kortin avausta kohti (30 min muisti 0,1°:n ruudulle, ei kiintiötä).
- *Laajan näkymän vetäminen ajassa* (`laajaSiirtoMs`) poistui:
  vierivä jakso vierii natiivisti, 48 h mahtuu kerralla.

### V4 — rakenne

Hero lukee Paras-sarjaa (luku, puuska, suunta); aikarivi ("NYT La 26.9.
klo 10 · FMI HARMONIE 2,5 km") korvaa tuntivalitsimen; foil-merkki on
indeksin otsikossa; osiot Tuuliennuste / Havainnot / Meri samalla
`.osio-otsikko`lla. Hero piirretään hiljaa uudelleen vain jos luku
muuttuu Parasin tultua (`spot._heroAvain`).

Löytö matkalla: **spottimerkki ja sen kortti olivat eri mieltä** kun
kortti siirtyi Parasiin (Lauttasaari 82 vs 46). Merkit lukevat nyt
samaa sarjaa (`_spotLukema`), ja Paras lasketaan taustalla kaikille
spoteille (`KorttiSarjat.esilataaSpotit`). Mitattu 4/4 spottia sama
indeksi merkissä ja kortissa.

### V5 — havaintokaavio

Täyttö kartan rampilla kuten ennusteessa (puuska 0,42 ×, tuuli täysi),
nuolet musteella, ja spottikortissa saman tunnin Paras-ennuste
katkoviivana (P9) — myös laajassa. Mellstenin 30 min ikkunassa viivaa
ei ole (alle kaksi tuntipistettä), ja se on oikein.

### V6 — laitteet

| mittaus | puhelin | iPad |
|---|---|---|
| vaakaveto +10 h valitsee noston tunnin | ✓ | ✓ |
| paneeli pysyy auki vedon jälkeen | ✓ | ✓ |
| värisevä napautus valitsee | ✓ | ✓ |
| pystyveto kaaviossa ei valitse | ✓ | ✓ |
| kontrolli: veto herosta sulkee iPadin paneelin | – | ✓ (suljettu) |

Näppäimistö (työpöytä): →, →, Shift+→, ← = +1, +2, +5, +4 h, fokus
pysyy kaaviossa jokaisen uudelleenpiirron yli, kartta ei panoroi.

### V7 — tyyli

| | ennen | jälkeen |
|---|---|---|
| inline-`style` kortissa | 550 | 173 |
| pyöreät napit kortissa (osumapinta / ympyrä) | laajennus 30/30 | kaikki 44/30 |
| segmenttivalitsimia | 2 tyyliä | 1 (`.segmentti`) |
| X-kuvion kopioita | 5 (kaksi viivanpaksuutta) | 1 (`_SULJE_SVG`) |
| laajan sulkunappi | `.hav-nappi` | `.paneeli-sulje` |

Kortin korkeus kasvoi 1 374 → 1 698 px: kaavio on 150 px korkea
(ennen 120) ja siinä on päivä-, tunti-, lähde-, nuoli- ja sadeivit, ja
mallivalikko on uusi. Strategian tavoite "ensimmäinen ruudullinen
sisältää heron ja koko kaavion" EI toteudu puhelimella puolikorkealla
pohjalevyllä — hero ja kaavion alku näkyvät, loput vierittämällä.

### `openSheet` joka tuntiaskeleella

*(V9:stä lähtien kortti EI rakennu uudelleen tunnin vaihtuessa — ks.
alla. Tämä osio on V7:n tilanne.)* Kortti rakennettiin uudelleen joka
aikajanan askeleella (kuten ennen), joten sen hinta mitattiin (mediaani 11 kutsusta, WebKit, rinnakkaiset
buildit vuorotellen):

| | vanha build | uusi, ensin | uusi, korjattu |
|---|---|---|---|
| 48 h | 5–7 ms (+ kaavio 50 ms:n viiveellä) | 37–42 ms | 4,9 ms |
| 7 vrk | – | 52 ms | 5,8 ms |

Kaavion piirto itse oli 0,4–1,5 ms. Loput oli **pakotettua asettelua**:
`kaare.scrollLeft`in luku ja 7 vrk:lla sen kirjoitus heti kortin
rakennuksen jälkeen asettelivat koko kortin synkronisesti. Nyt uuden
kääreen vieritystä ei lueta (se on aina 0), leveys muistetaan
ikkunan koon mukaan, ja vierivän jakson sijainti asetetaan ruudun
jälkeen (varalla 120 ms ajastin, koska WebKit voi pidättää
ruutupyynnön kosketusvierityksen ajan).

Kartan pakotettu malli säilyy kortin laskennan yli (mitattu: ICON,
perheiden `pois`-tilat ja `dyn.api` samat ennen ja jälkeen).

### V8 — yksi kaaviomoottori, ei jaksovalitsimia (27.9.)

Pyyntö: *"Spottikortissa ei tarvitse olla valintaa siitä miten pitkä
data näkyy kun nyt graafia pystyy kivasti rullaamaan sivuun ja
eteenpäin. […] tuntia klikkaamalla se siirtyy smoothisti seuraavaan
tuntiin nopeahkolla animaatiolla […] Selvennetään nykyhetken kohtaa ja
tehdään tarvittaessa nappi että voi palata nykyhetkeen […] apin kaikki
graafit muualla ovat samalla tyylillä […] uimavedet yms."*

**Ennuste.** Jaksovalitsin (48 h / 7 vrk / Kaikki) poistui: koko sarja
(akselin alusta, noin kaksi vuorokautta menneisyyttä, loppuun) on
piirretty ja sitä vieritetään; ruudulle mahtuu 48 h (laajassa 72 h).
Vaakaveto on AINA natiivia vieritystä — tunti valitaan napautuksella tai
nuolilla, ei vedolla (V6:n "48 h:n vaakaveto valitsee noston tunnin"
kumoutui, koska vierivässä kaaviossa veto on vieritys).

- **Pehmeä siirto.** Valittu kursori ja pallo ovat CSS-transformilla
  sijoitettuja ryhmiä (`.tk-valittu`, `.tk-valittu-piste`, 0,22 s
  `cubic-bezier(.2,.8,.2,1)`), ja tunnin vaihto kirjoittaa vain
  transformin (`Tuulikaavio.siirraValittu`). Mitattu WebKit, napautus
  +3 h: transform 358,4 → **374,4 (70 ms kohdalla)** → 380,3, eli
  välitila on olemassa; 4/4 napautusta osui oikeaan tuntiin. Jos tunti
  on näkyvän alueen ulkopuolella, kaavio vierii sinne pehmeästi
  (`Aikakaavio.naytaHetki`). `prefers-reduced-motion` poistaa siirtymän.
- **Kortti ei rakennu uudelleen tunnin vaihtuessa** (`openSheet`:n
  päivityspolku): vain hero (`#sh-tunti`), tunnin laatat
  (`#sh-laatat-tunti`) ja tekstit (`#sh-tiedot`) kirjoitetaan, ja
  ennusteosio saa `asetaValittu`n. Mitattu: ennusteosio ja sen SVG ovat
  SAMA elementti ennen ja jälkeen neljän napautuksen. Hinta WebKit,
  mediaani: täysi rakennus 17–18 ms, päivitys **7 ms**.
- **Nykyhetki.** NYT-lappu (musta pilleri) ja katkoviiva nykyhetken
  kohdalla, menneisyys paperiharsolla (.42), ja otsikkorivillä
  **Nyt-nappi**, joka näkyy vain kun valinta tai näkymä on muualla kuin
  nykyisessä tunnissa. Mitattu: näkyy valinnan jälkeen, napautus vie
  `valittuMs`:n `Ennuste.nytTunti()`in (sama pyöristys kuin aikajanan
  `nowIdx`) ja piilottaa napin. NYT-lappu piirretään kursorin PÄÄLLE:
  kun valittu tunti oli nyt, kursorin viiva halkaisi lapun ("N|YT").
- **Kiinteä y-akseli** (`Aikakaavio._akseli`, `.ak-kehys`): luvut ovat
  kääreen päällä kapean paperiliu'un kanssa eivätkä vieri. SVG:hen
  piirrettyinä vieritetyn kaavion vasemman reunan luvut leikkautuivat
  ("0" luki "30":n paikalla).
- **Asteikko nykyhetkestä eteenpäin.** Koko sarjan huippu oli
  menneisyyden myrsky (puuska 18,2 m/s → asteikko 22 m/s) kun ennusteen
  huippu oli alle puolet siitä; tavallinen 5 m/s oli 34 px:n korkuinen.
  Asteikko lasketaan nyt hetkestä nyt − 6 h loppuun, ja menneisyys
  leikataan piirtoalueen yläreunaan (`clipPath`) — sen luku kertoo arvon.
- **Hajonta sanotaan kerran**, herossa (se oli myös kaavion alla).
- **Lähde tuulisolun nimessä** lukemarivillä ("Tuuli · FMI HARMONIE
  2,5 km"): omana 14 px:n solunaan se rivitti puhelimella ja nosti rivin
  korkeutta tunnista toiseen.

**Havainto, vedenlämpö ja aallot samalla moottorilla.** Kaikki neljä
kaaviota ovat nyt `Tuulikaavio.piirra` + `Aikakaavio` (kääre, kiinteä
akseli, kiinteä lukemarivi `.en-lukema`, osoitin): sama päiväotsikko,
tuntirivi, täyttö, `--ink`-viiva, luvut käyrällä, suuntarivi ja
tuoreimman lukeman piste (`loppuPiste`). Kelluvat työkaluvihjeet ja
vanhat piirtofunktiot (`HAV_ASU_*`, `UW_ASU_*`, 30 h / 7 vrk -napit)
poistuivat.

| kaavio | historia | ruudulle | laajassa | jaksonapit ennen |
|---|---|---|---|---|
| tuuliennuste | koko akseli | 48 h | 72 h | 48 h / 7 vrk / Kaikki |
| tuulihavainto | 48 h spottikortissa, 7 vrk asemakortissa | 24 h | 48 h | 6 h / 24 h / 3 vrk / 7 vrk |
| vedenlämpö | 30 vrk | 7 vrk | 14 vrk | 7 / 30 vrk / Kaikki |
| aallot, meriveden lämpö | 7 vrk | 48 h | 72 h | 30 h / 7 vrk |

- Havainnossa luku on ikkunan keskiarvo ja puuska sen maksimi
  (`ikkunaLuvut`), ja **jakson kovin puuska saa aina lapun** myös
  reunaikkunassa (moottori lisää sen jos ikkunaluvut ohittivat sen).
- Havainnon asteikkoon ei oteta ennusteen puuskaa (se ei piirry
  havaintokaavioon): mitattuna se nosti 16 kts:n havainnon asteikon
  25 kts:iin.
- Tilastot (keskituuli, kovin puuska, vallitseva, ilma, ruusu) ovat
  viimeisen 24 h:n, ja jakso sanotaan KERRAN ryhmän otsikossa
  ("Viimeiset 24 h") — nimen perässä "Kovin puuska 24 h" katkesi
  puhelimella kolmeen pisteeseen.
- Vedenlämmössä ei ole yöharsoa (vuorokaudenaika ei ole päätöksen osa,
  ja viikon näkymässä se olisi seitsemän raitaa), päivän luku on klo 12
  kohdalla, tuntiriviä ei piirretä päivätasolla, ja tiheän päivärytmin
  rajat ovat hiljaisempia (.16). Historia rajattiin 30 vrk:een: 60
  vrk:lla elokuun 21,8° litisti syyskuun viikon pohjalle.
- Yöharso on moottorissa nyt täytön PÄÄLLÄ ja viivojen alla (CLAUDE.md):
  täytön alla se luki korostuslaatikkona kaavion yläosassa.
- SVG:n `<text>`-elementtien `style="font-variant-numeric"` siirtyi
  CSS:ään (`.tk-svg text`): inline-`style`-attribuutteja kortissa
  317 → 62.

**Muut:** Porvoo Kilpilahti satama (FMISID 100683) on uusi meriasema
rekisterissä (`FMI_MAP_STATIONS` ja `api/fmi.js`), ja
`FMI_SEA_PLACES` johdetaan rekisterin tagista eikä ole enää oma
listansa. Sivun nimi on "FoilSpot" (oli "FoilSpot v7-light").

### V9 — kortti moduuleiksi, havaintokortit samaan tyyliin (27.9.)

Pyyntö: *"spottikortissa on nyt paljon dataa ja se pitäisi saada
jotenkin jaoteltua kivasti eli tekstiosia oisi omanaan ja ei olisi niin
hallitseva […] Tee tuuli havaintoasemien korteista saman tyyliset kuin
spottikortin graafista."*

**Päätös: Applen Sään rakenne paperille.** Jokainen asia on oma
korttinsa (`.sh-moduli`: korotettu paperi, 16 px kulma, hiusreuna),
ryhmät nimetään pienellä versaalilla (`.sh-ryhma`), ja yksittäiset luvut
ovat laattoja kahdessa sarakkeessa (`.sh-laatat`). Järjestys on
päätöksen järjestys: **nyt → tunneittain → yksityiskohdat → tekstit**.

| osa | puhelimella (y + korkeus, px) | vaihtuu tunnin mukana |
|---|---|---|
| hero: tuuli, suunta, puuska, päätös, hajonta | 68 + 177 | kyllä |
| tuuliennuste ja mallit | 257 + 459 | kursori liukuu |
| valitun tunnin laatat (ilma, puku, aallot, vesi, aurinko) | 736 + 224 | kyllä |
| havainnot nyt: laatat | 1 000 + 236 | ei |
| tuulihavainto, vedenlämpö | 1 283 + … | ei |
| tekstit: indeksin erittely, suunnat, lähde | 2 109 + 162 | kyllä |

- Päätös sanotaan kerran: foil-merkki ja vierellä vain se mitä se ei jo
  kerro, eli suunta (`spotIndexHuomio`). Heron rivillä luki ennen
  vierekkäin "Rajatuuli – kokeile" ja "Liian heikko" (4,6 m/s).
- Spottiindeksin rengas sai nimen ("spottiindeksi").
- Tekstit (indeksin erittely, sopivat suunnat, ennusteen lähde) ovat
  alimpana omassa moduulissaan pienempinä — kuvaus ei toistu siellä,
  koska se on jo nimen alla.
- Ilmalaatta jää pois asemalta jolla ei ole lämpömittaria (Laru): se
  näytti "— °C, kastepiste —°".
- **Havaintoasemakortti** (`_openObsSheet`) käyttää samoja osia: nimi ja
  lähde ylhäällä, "Viimeisin lukema" -hero `.sh-big-wind`illä (ja
  puuska), kaavio moduulissa otsikolla, tilastot kaavion alla samoina
  soluina (`.hav-tilasto`) myös aaltopoijulla.

**Fontit ja sulkunappi.** Mitattu puhelimella (WebKit, kaikki näkyvät
tekstit, SVG skaalattuna): ennen 22 tekstiluokkaa alle 11 px:n, pienimmät
8 px (NYT-merkki, asemavalitsimen etäisyys ja tagi, laajan lukemarivin
nimet) ja 9 px (puuskasuhde, jaksovalitsin, asemavalitsimen nimi, laajan
alaotsikko 8,5). Jälkeen pienin HTML-teksti 11 px ja SVG:ssä 10,5 px
(NYT-lappu versaalina pillerissä ja ruusun ilmansuunnat). Lattia on
yhdessä CSS-lohkossa `max(Npx, var(--fs-x))`-muodossa, joten työpöydän
suuremmat tokenit säilyvät. Laajan otsikko on 17 px (työpöydällä 20),
kuten paneelien otsikko, ja lukemarivin arvo 17 px (oli 11).
Sulkunapin ympyrä on 32 px (oli 30) kaikissa neljässä paneelissa ja
laajassa; osumapinta pysyy 44 px:nä.

**Regressiot (samat harnessit kuin V0–V7):**

| mittaus | tulos |
|---|---|
| kortti vs aikajana spotissa, 48 h, 5 spottia | 0,0000 m/s |
| spottimerkki = kortin indeksi | 4/4 |
| näppäimistö →, →, Shift+→, ← | +1, +2, +5, +4 h, fokus pysyy, kartta ei liiku |
| värisevä napautus valitsee (puhelin, iPad) | ✓ ✓ |
| pystyveto kaaviossa ei valitse | ✓ ✓ |
| vaakaveto kaaviossa ei sulje paneelia | ✓ ✓ |
| kontrolli: veto herosta sulkee iPadin paneelin | ✓ |
| sivuvirheitä (`pageerror`) | 0 |

### Mitä ei voitu mitata täällä

Ruutunopeutta ei (kontti, ks. CLAUDE.md). Aikajanan raahaus kortin
ollessa auki kannattaa tarkistaa laitteella, samoin kursorin siirtymän
tuntuma: kontti näyttää että välitila on olemassa, ei miltä se tuntuu.

### V10 — laajan valinta, Paras (malli), venytys ja mallit laajassa (28.9.)

Käyttäjän pyyntö: laajan näkymän napautus ei vaihtanut tuntia, Paras-siru
ei tehnyt mitään, kaavioita pitää voida venyttää kahdella sormella,
lukemat eivät saa mennä päällekkäin tai piiloon, laajan pyyhkäisyalue
korkeammaksi ja laajaan mallivalikko.

**Laajan napautus.** Syy oli koodissa eikä laitteessa: laajan
tuuliennusteen osoittimella ei ollut `napautus`ta lainkaan, joten
napautus siirsi vain osoitinviivaa (joka jäi näkyviin), ja valitun tunnin
kursori jäi avaushetken tuntiin. `asetaValittu` päivitti lisäksi vain
kortin kääreen. Nyt laaja valitsee samaa polkua kuin kortti (`valitse` →
`_tlValitseIdx` → `asetaValittu`), ja `asetaValittu` siirtää kursorin
myös laajassa (`ctx.laajaKaare`). Laajan lukemarivi on levossa 48 h:n
yhteenveto ja laajassa valitun tunnin jälkeen sen tunnin luvut.
Mitattu WebKitillä (iPhone-konteksti) ja Chromiumilla CDP-kosketuksella:
kaksi peräkkäistä napautusta laajassa siirtävät kursorin laajassa ja
kortissa samaan tuntiin, näkyviä osoitinviivoja 0/0.

**Haamuosoitin.** WebKit lähetti hiiren `pointermove`n kun laaja
ilmestyi paikallaan olevan (emuloidun) osoittimen alle — yli sekunnin
napautuksen jälkeen — ja laajan päälle syttyi osoitinviiva jota kukaan ei
osoittanut (sama vanhassa buildissa: 0/1 heti avauksen jälkeen). Leijuva
osoitin on nyt vain laitteella jolla `(any-hover: hover)`, ja lisäksi
sekunnin ajan kosketuksesta ohitetaan hiiren liike. Jälkeen 0/0.

**Paras (malli).** Paras-siru poistettiin, koska se ei ole valinta.
"Vertaa kaaviossa" -rivi sanoo `Paras (FMI HARMONIE 2,5 km) · ICON ·
GFS`: sulkeissa on VALITUN TUNNIN lähde (`Lahde.LYHYET`), koska Paras
on sekoitus jonka malli vaihtuu ajan mukana — mitattuna Lauttasaaressa
HARMONIE → ECMWF 9 km vuorokauden 1.10. kohdalla.

**Sarja joka jo latautui.** `KorttiSarjat.lataa` palautti kesken olevan
haun kytkemättä uutta `kun`-kuuntelijaa. Hajontaa varten ECMWF, ICON ja
GFS haetaan taustalla 1,2 s kortin avauksen jälkeen, joten sirun painallus
sen aikana ei piirtänyt viivaa kun sarja saapui (mitattu: 0 viivaa 6 s
painalluksen jälkeen). Nyt kuuntelija kytketään myös kesken olevaan.

**Venytys** (`Aikakaavio.venytys`, kaikki neljä kaaviota kortilla ja
laajassa). Tiheys on "näkyviä tunteja ruudulla" (`Aikakaavio.nakyva`),
muistetaan istunnon ajan kaaviotyypeittäin (`ennuste`, `ennuste-laaja`,
`havainto`, `vesi`, `aalto` ja laajat) eikä tallenneta. Rajat:

| kaavio | oletus | lähin | kaukaisin |
|---|---|---|---|
| ennuste kortti / laaja | 48 / 72 h | 12 h | 7 / 10 vrk |
| havainto | 24 / 48 h | 3 h | 7 vrk |
| aallot | 48 / 72 h | 12 h | 7 vrk |
| vedenlämpö | 7 / 14 vrk | 2 vrk | 30 vrk |

ja kaikissa lisäksi sarjan pituus (sen yli koko sarja on jo ruudulla).
Eleen aikana SVG:tä vain venytetään transformilla, ja sormien noustessa
kaavio piirretään uudelleen. Kesken eleen korvattu SVG irrottaisi
kosketuksen kohteen eivätkä seuraavat tapahtumat enää kuplisi kääreeseen.
Venytyksen keskipiste (hetki sormien välissä) pysyy sormien alla.
Kosketustapahtumat eivätkä osoittimet, koska `pan-x pan-y` -kääreessä
selain peruu osoittimet omaan vieritykseensä. Liike ei kupli
pohjalevyn pyyhkäisyyn. Kahden sormen ele ei ole napautus (osoittimet
lasketaan, ja 350 ms venytyksen jälkeen ohitetaan). Työpöydällä
Ctrl+rulla ja kosketuslevyn nipistys; sivun zoom pysyy 1:ssä.
Y-asteikko ja korkeus eivät riipu tiheydestä. Vedenlämmön asteikko ja
"Vaihtelu"-luku laskettiin ennen nipuista, joiden koko riippuu
leveydestä, joten ne olisivat eläneet sormien mukana. Nyt ne lasketaan
raakamittauksista.

**Päällekkäisyys.** Mittari lukee jokaisen näkyvän `<text>`in ruudulta
(y-akselin paperiliu'un oikealta puolelta) ja etsii leikkaukset ja
SVG:n rajojen ylitykset. Löydetyt ja korjatut:

| löydös | korjaus |
|---|---|
| "sade mm/h" jokaisella keskiyöllä, 7 vrk ruudulla 7 paria päällekkäin | nimi vain jos edellinen on oman leveytensä + 30 px päässä |
| lukuväli katkesi 24 h:iin: kuukausi ruudulla antoi päivän luvut 12 px välein | porras jatkuu 48 / 72 / 168 h, keskipäivä joka k:s päivä |
| laaja vaakaruudussa: y-akseli tyhjä (20 kts:n porras, asteikko 19 kts) | vähintään yksi viiva: suurin porras joka mahtuu asteikon alle |
| laaja vaakaruudussa: SVG 244 px kääreessä 235 px | mallirivi otsikkoriville vaakassa |
| allekkain-rivin mallin nimi 1–2 px rivin yläreunan yli laajassa | nimikaista `15 · fs` |
| mallin ja lähteen nimi x = 4 eli y-akselin liu'un alla | alku 38 px:stä kun akseli on kiinteä |

Jälkeen puhelimella ja iPadilla (Chromium, CDP-kosketus) venytyksen
ääripäissä: ennusteen kortti 12 h … 7 vrk, laaja allekkain kolmella
mallilla loitonnettuna ja lähennettynä, havainto 3 h … 48 h ja vedenlämpö
2 … 30 vrk: päällekkäin 0 ja rajojen yli 0 kaikissa. Y-akselin lukuja
on joka vaiheessa ≥ 1.

**Allekkain ei mahdu → päällekkäin.** Laajan rivin vähimmäiskorkeus on
70 px ja pääkaavion 120 px. Puhelimen vaakaruudussa laatikko on noin
250 px, ja kolme riviä vuoti ennen laatikon alareunan yli, jolloin
alimmat mallit jäivät piiloon (`overflow: hidden`). Nyt mallit
piirretään silloin päällekkäin, ja Allekkain-nappi on yliviivattu ja
kertoo syyn (`title`). Valinta pysyy, ja pystyssä rivit palaavat.

**Mallit laajassa.** Laajan lähde voi antaa työkalurivin
(`lahde.tyokalut`), ja tuuliennuste antaa siihen samat sirut ja
asettelun kuin kortin "Vertaa kaaviossa" (`_sirutHtml`, `_kytkeSirut`).
Tila on yksi, joten valinta kummassa tahansa piirtää molemmat
(`_muuttui`). Pystyssä rivi on otsikon alla, vaakassa otsikkorivillä.

**Pyyhkäisy alas laajassa** alkaa nyt mistä tahansa piirtoalueen
yläpuolelta: kahvasta, otsikosta, lukemariviltä, mallirivin väleistä ja
kaavion omilta päivä- ja tuntiriveiltä (`_piirtoalueenYlapuolella`, raja
`g.y0`). Mallirivi ja kaavio vierivät sivuttain, joten niissä veto on
sulkuele vasta kun se on selvästi alaspäin (10 px, ja vaakaliike ensin
perii eleen). Mitattu: veto piirtoalueelta ei sulje, veto päiväriviltä
sulkee.

**Mitä ei voitu mitata täällä.** Venytyksen tuntuma, eli se miltä
transformilla venytetty kuva ja sen korvaava piirros näyttävät
sormien alla. Playwrightin WebKit ei osaa kahta sormea, joten venytys on
mitattu Chromiumilla ja napautukset WebKitillä. iOS:n oman sivuzoomin
esto (`gesturestart`) on pääteltyä eikä mitattua.

### V11 — ennustevalikko, kiinteä lukemarivi ja selkeämpi päiväys (2.10.)

Käyttäjän pyyntö: "varmistetaan että menneessä ajassa myös
tuuliennustegraafin yläpuolella oleva paneeli ei missään tapauksessa
kasva pituussuunnassa ja teksti näkyy", "nätti ammattimainen valikko
josta voi valita mitä ennustetta graafi näyttää", "vasta kun graafi
avataan isoksi voi valita oletuksen pohjaksi ja lisätä muita käyriä
päällekkäin", "allekkain-valintaa ei tarvita" ja "selkeämpi päivämäärä
graafilla" — kaikkiin kaavioihin yhdenmukaisesti.

**Lukemarivi kasvoi menneellä tunnilla.** `.en-lukema` oli
`flex-wrap: wrap` + `min-height: 48px`. Menneellä tunnilla aikasolu on
"Mennyt · Pe 2.10." ja tuulisolun nimi "Tuuli · FMI HARMONIE 2,5 km",
eivätkä ne mahtuneet puhelimen riville: mitattuna 48 → **83 px**, ja
kaavio hyppäsi alas joka kerta kun valinta siirtyi menneeseen. Nyt rivi
on `nowrap` ja **kiinteä 54 px** kaikissa neljässä kaaviossa: sivusolut
(aika, puuska, suunta, jakso…) ovat nimensä levyisiä eivätkä kutistu,
pääsolu ottaa jäljelle jäävän tilan ja vain SEN nimi (lähde) katkeaa
kolmeen pisteeseen. Kapealla kortilla (`@container`, moduulin
sisäleveys ≤ 340 / ≤ 280 px) väli ja pääluku pienenevät. Mitattu
kaikki rivit 360, 390 (fi, en) ja 320 px leveydellä: korkeus 54 px,
yhtään solua ei reunan yli eikä yhtään arvoa leikattu. Ensimmäinen
yritys katkaisi KAIKKIEN sivusolujen nimet arvon levyisiksi, ja
aaltorivin "Jakso" luki "P…" — siksi vain pääsolun nimi katkeaa.

**Laajan lukemarivi on sama komponentti** (`HavLaaja.rivi` →
`Aikakaavio.lukemaHtml`). Oma `hl-lk`-rivi rivittyi puhelimen pystyssä
kolmella päällekkäisellä käyrällä neljälle riville (mitattu 130 px).
Päällekkäiset käyrät ovat toisella kiinteällä rivillä väripisteellä
(`.on-mallit`, 80 px), ja levossa niille näytetään sama 48 h keskiarvo
kuin pääsarjalle, jotta korkeus ei vaihdu levon ja osoittamisen välillä
(mitattu 88 px laatikkoineen molemmissa suunnissa).

**Ennustevalikko.** "Vertaa kaaviossa" -rivi, kortin mallisirut ja
Päällekkäin/Allekkain poistuivat. Tilalla on valintakenttä kaavion
yllä (`.en-pohja`: nimi, alla mistä se on — Parasta valitun tunnin
lähde), ja se avaa `Valikko`n: kelluva lista (`body`n lapsi, `fixed`,
koska moduulin `overflow: hidden` leikkaisi sen), rivit
`role="option"`, nuolet, Enter, Esc (globaalin Esc-listan
ensimmäinen), ohi napautus ja sarkain sulkevat ja fokus palaa
kenttään. Vaihtoehdot ovat Paras saatavilla ja viisi mallia
(`KorttiSarjat.PARAS` + `MALLIT`, alatekstit samat kuin asetusten
"Kartan malli" -listassa). **Kortilla kaavio näyttää vain valitun
ennusteen**; laajassa sama kenttä valitsee pohjan ja sen vieressä on
"Lisää"-sirurivi muille malleille (väri ja viivakuvio ovat käyrän omat,
joten siru on myös selite), enintään kolme. Tila on yksi
(`fs_kortti_mallit`: `{ pohja, valitut }`; vanha `asu` ohitetaan), ja
pohja ei ole koskaan päällekkäinen käyrä. Kartan pakottama malli syttyy
yhä päällekkäiseksi käyräksi laajassa (P3). Jos valittu malli ei anna
sarjaa (alueellinen malli tai kaatunut haku), kortti sanoo sen ja
napautus yrittää uudelleen — toiseen ennusteeseen ei vaihdeta hiljaa,
ja edellisen ennusteen akseli ja lukemat tyhjennetään.

Allekkain-asu poistui Ennusteesta kokonaan (käyttäjän päätös: "turha").
Moottorin `Tuulikaavio.ASUT.rivi` jäi, mutta sitä ei käytä enää mikään
kaavio.

**Selkeämpi päiväys (kaikki kaaviot).** Päiväotsikko on oma kaistansa
(heikko pohja, `paivaH` 17 → 22, laajassa 20 → 25), ja leveällä
päivällä viikonpäivä kirjoitetaan kokonaan ja lihavana ("**Torstai**
1.10.", portaikon uusi ylin porras; muut portaat ennallaan). Tämä päivä
on kermapilleri ("Tänään 2.10.") — sama muoto kuin NYT-lappu ja
aikajanan valintapilleri. Päiväraja on vahvempi (.24 → .34, 1 px) ja
jatkuu kaistan läpi. `tools/graafimittaus.mjs`: kaikki tarkistukset
läpi (päivämäärä joka vierityskohdassa 0,0 % ilman kaikilla zoomeilla).
Ensimmäisessä versiossa leveystarkistus laski välilyönnin myös
pelkälle kirjaimelle, ja 396 h:n zoomilla päivät katosivat — mittari
huomasi sen.

**Aikajana.** Kuplan oikealle puolelle tuli paluunappi (`#tl-nyt`,
kuplan lapsi `left: 100%`, joten kupla pysyy osoittimen keskellä):
sama kermamateriaali kuin kupla, 26 px ja 44 px osumapinta. Näkyy vain
kun valittu tunti ei ole nyt (`Ennuste.nytTunti`, sama pyöristys kuin
`nowIdx`), ja vie `_tlValitseIdx(nowIdx)`:iin kuten Home. Kuvake on
sama `_PALUU_SVG` kuin kaavion Nyt-napissa. Tämän päivän kiskolappu
sanoo "Nyt" eikä "Tänään", koska sen napautus vie nykyhetkeen.
Mitattu: nappi näkyy menneellä tunnilla, napautus valitsee nyt-tikin
ja nappi piiloutuu.

---

## 8. Rauhallinen ja vakaa kortti — strategia (3.10.2026)

Pyyntö (3.10.2026): *"Lähdetään seuraavaksi tekemään spottikortille
strategia sen parantamiseksi niin, että siitä tulee mahdollisimman
ammattimainen. Esimerkiksi kun spottikortin avaa ja sieltä avaa
ennustekaavion, niin ennustekaavion erilaiset säämallit tulevat
infoboksiin, jossa nämä boksit tai uudet tekstit ja tuulennopeudet
menevät hieman pois näkyvistä, jolloin se ei ole täydellinen. Lisäksi en
halua, että spottikortissa mikään niin kuin koko muuttuu tämmöisillä
infobokseilla, jos graafia muuttaa, ettei se tule mitään värinää
korttiin. Tee kokonaisvaltainen parannus spottikortille niin, että siitä
ei tule liian vilkas. Ehdota jotain dataa, että tarvitseeko poistaa, jos
siellä esimerkiksi kaksi kertaa jotain dataa. […] tee ensin strategia,
äläkä koodaa mitään ja tee suositus minulle ja minä päätän."*

**Tila:** päätetty 3.10.: *"Tehdään kaikki suosituksen mukaan mutta ei
poisteta kuplaa kaavioista."* Eli P10 A, P12 A, P13 A, P14 A, P15
kohdat 1–11 (kohta 12 oli makuasia, eikä sitä tehty), P16 A ja P17 A;
P11:stä kupla jää, mutta kiinteän kokoisena ja koskaan leikkautumatta
(suosituksen B kokoehto ilman sen yksirivisyyttä: mallit pysyvät
kuplassa, koska ne olivat 30.9. pyynnön ydin). Toteutus ja mittaukset
ovat luvussa 8.10.

### 8.1 Tiivistelmä

**Diagnoosi.** Kortin osat ovat yksitellen mitattuja ja hyviä, mutta ne on
rakennettu eri päivinä eri pyynnöistä, eikä niiden yhteisvaikutusta ole
mitattu. Nyt mitattuna (puhelin 390 px ellei toisin sanota):

1. **Laajan vertailumallit jäävät piiloon.** "Lisää"-sirurivi on yksi
   sivuttain vierivä rivi ilman merkkiä jatkosta, ja valitut mallit ovat
   sen lopussa: kolmella valitulla mallilla **GFS näkyy 0 % ja ICON
   0–14 % jokaisella puhelimella**, pystyssä ja vaakassa, ECMWF 0–100 %.
   Englanniksi lukemarivin mallirivi leikkautuu (GFS:n arvo 49 %
   näkyvissä 360 px:llä). Tämä vastaa pyynnön kuvausta "boksit, tekstit
   ja tuulennopeudet menevät pois näkyvistä".
2. **Koko muuttuu.** Laajassa ensimmäinen vertailumalli kasvattaa
   lukemariviä 54 → 80 px ja lyhentää kaaviota saman verran
   (vaakaruudussa 247 → 221 px, −11 %). Kortissa ennusteen vaihto
   valikosta muuttaa ennusteosion korkeutta (418 → 406 → 418 px
   paikanpitäjän takia, 436 → 418 px sadekaistan takia). 375 px:n
   puhelimella hero on neljää eri korkeutta tunnista riippuen, ja
   ennustekaavio hyppää pystysuunnassa **44 kertaa 127 tunnin aikana**;
   valitun tunnin laatat ovat 7–9 eri korkeutta. Avatessa moduulit
   asettuvat 8,5 sekunnissa, ja viimeisenä ilmestyvä aaltomoduuli työntää
   kaiken alla olevan 306 px alemmas.
3. **Sama tieto 2–5 kertaa.** Valitun tunnin tuuli ja puuska ovat herossa
   ja heti alla lukemarivillä, lähde "FMI HARMONIE 2,5 km" neljästi,
   havaintoaseman nimi neljästi, "Havainnot nyt" -laatat toistavat alla
   olevien kaavioiden lukemat, eikä "Spotti"-moduulissa ole mitään mitä ei
   olisi muualla. Kun kaavioon valitaan ICON, hero ja lukemarivi näyttävät
   samalle tunnille **eri luvut** (6,9 vs 9,2 kts).
4. **Kortti on raskas.** 2 835 px (4,1 ruudullista), 32 tekstityyliä, 10
   kirjasinkokoa, 10 tekstiväriä ja levossa 15 puoliksi näkyvää
   kaaviotekstiä.

**Suositus: viisi vaihetta V12–V16, pyynnön näkyvin vika ensin.** Ydin:

- **Yksi lukema, yksi paikka.** Kortilla hero *on* ennustekaavion lukema:
  levossa valittu tunti, kaaviota osoittaessa osoitettu tunti. Erillinen
  lukemarivi ja kupla pallon vieressä poistuvat. Laajassa lukemarivi on
  ainoa lukema, ja vertailumallit ovat sen soluja, joten rivi on samalla
  käyrien selite.
- **Kiinteät mitat.** Jokainen alue on samankorkuinen riippumatta
  tunnista, kielestä, ruudun leveydestä, ladatusta datasta ja mallien
  määrästä. Teksti joka ei mahdu, vaihtuu lyhyempään muotoon — se ei
  rivity eikä leikkaudu.
- **Kahdennukset pois** (lista 8.4.4): "Havainnot nyt" -laatat,
  aaltoennustelaatta, Spotti-moduuli, lähde herosta ja valikosta, aseman
  nimi otsikoista.
- **Rauhallisempi kaavio ja typografia:** kortin kaaviossa vain tuulen
  luvut, ei puoliksi näkyviä tekstejä, kuusi kirjasinkokoa ja
  varoitusväri vain varoituksiin.

Päätettävät kohdat P10–P17 ovat luvussa 8.5, jokaisella suositus;
"mennään suosituksella" riittää vastaukseksi.

### 8.2 Nykytila mitattuna

Asetelma: tuotantobuild (`npm run build` + `vite preview`), Chromium
(kontissa ei ole WebKitiä) ja oikea data 3.10. klo 12–13, Lauttasaari.
Puhelin 390 × 844 (`hasTouch`, dpr 3), lisäksi 360 × 780, 375 × 667,
vaaka 667 × 375 ja 844 × 390, iPad 820 × 1180 ja työpöytä 1440 × 900;
suomi ja `?kieli=en`. Mittarit ovat istunnon työtiedostoja; pysyvä
mittari on V12. Kontin kirjasin on Arialin mittainen (Liberation Sans),
joten iPhonen SF-kirjasimella leveydet poikkeavat muutaman prosentin.
Alla luetellut leikkautumiset johtuvat rakenteesta (`nowrap` +
`overflow: hidden` tai vierivä rivi), eivät kirjasimesta.

#### 8.2.1 Laajan vertailumallit ja lukemat

Valittujen mallisirujen näkyvä osuus laajan "Lisää"-rivillä, kun
valittuina ovat ECMWF, ICON ja GFS (rivillä ennen niitä HARMONIE ja MET
Nordic):

| laite | ECMWF | ICON | GFS |
|---|---|---|---|
| 360 px pysty | 72 % | 0 % | 0 % |
| 375 px pysty | 89 % | 0 % | 0 % |
| 390 px pysty, englanti | 100 % | 14 % | 0 % |
| 667 px vaaka | 0 % | 0 % | 0 % (MET Nordic 3 %) |
| 844 px vaaka, englanti | 34 % | 0 % | 0 % |
| iPad, työpöytä | 100 % | 100 % | 100 % |

Rivi vierii sivuttain, mutta mikään ei kerro sitä, ja vaakaruudussa —
kääntämällä avattu laaja on sen tavallisin käyttötapa — valitut mallit
eivät näy lainkaan.

- **Lukemarivin mallirivi** (`.en-lk-mallit`, `nowrap` + `overflow:
  hidden`): englanniksi levossa "GFS mean 11.5" menee 390 px:llä 24 px
  reunan yli ja näkyy 360 px:llä 49 %. Suomeksi rivi mahtuu, mutta ilman
  varaa.
- **Kupla** (`data-tk-kupla`): leveys arvioidaan merkkimäärästä ja
  vaihtelee osoitetun tunnin mukaan (pystyssä 111–125 px, vaakassa
  124–139 px), ja kupla vaihtaa puolta. Se näyttää samat luvut kuin
  lukemarivi: työpöydällä ja vaakaruudussa samat viisi lukua (tuuli,
  puuska, ECMWF, ICON, GFS) kahdesti, eri järjestyksessä ja eri
  kokoisina.
- **Valikkokentän alarivi** katkeaa laajassa ("Tällä tunnilla FMI
  HARMONIE 2,…").
- **Kaavion päällekkäisyydet:** NYT-lappu peittää y-akselin
  "kts"-yksikön kun nykyhetki on vasemmassa reunassa, ja tuntirivin
  pilleri peittää alleen jäävän tuntiluvun puoliksi ("Ma 10" + "2").

#### 8.2.2 Mikä muuttaa kokoaan

| tilanne | mitä muuttuu | mitattu |
|---|---|---|
| laajassa ensimmäinen vertailumalli päälle | lukemarivi 54 → 80 px, kaavio lyhenee | pysty 619 → 593, vaaka 247 → 221 (−11 %), iPad 955 → 929, työpöytä 757 → 731 px |
| laajan lepo ↔ osoitus | rivin solut ja niiden määrä vaihtuvat (lepo "Keskituuli 48 h · Kovin 48 h", osoitus hetki · tuuli · puuska) | luvut siirtyvät vaakaan |
| kortin ennusteen vaihto, sarja ei vielä valmis | "Ladataan ennustetta…" (230 px) kaavion (242 px) tilalle | osio 418 → 406 → 418 px; kaikki alla hyppää kahdesti |
| ennusteen vaihto (ICON) | sadekaista piirretään vain jos jaksossa sataa | osio 436 → 418 px |
| tunnin vaihto, 375 px | hero 180 / 188 / 196 / 200 px: puuskarivi rivittyy ("×1,6 hyvin puuskainen", 15 → 27 px), aikarivi rivittyy (12 → 28 px), päätösrivi rivittyy ("Rajatuuli – kokeile" + "42° sivussa parhaasta", 20 → 40 px) | kaavio liikkuu pystysuunnassa 44 kertaa 127 tunnissa |
| 360 px ja työpöydän sivupaneeli | heron aikarivi rivittyi kahdelle riville; sivupaneelissa toinen rivi alkaa irrallisella "·":llä | — |
| tunnin vaihto, kaikki leveydet | valitun tunnin laatat ilmestyvät ja katoavat (aalto- ja vedenkorkeusennuste eivät kata mennyttä), alarivejä 1–3 | 7–9 eri korkeutta (210–382 px), 20 muutosta / 127 h; kortin kokonaiskorkeus 13–20 eri arvoa |
| tunnin vaihto ja osoitus kortin kaaviossa | lukemarivin pääluku siirtyy vaakaan 70 ↔ 108 px kun tunti on mennyt ("Mennyt · La 3.10."), puuskasolu 248–271 px | 127 tunnissa 7 eri asettelua (375 px: 13) |

390 px:n puhelimella suomeksi hero pysyi tässä datassa vakaana (180 px
koko 127 tuntia), mutta samat rivitykset laukeavat siellä pidemmillä
teksteillä (englanti, pitkä päätösrivi). Vika on rakenteessa, ei yhdessä
leveydessä.

#### 8.2.3 Avaus: moduulit asettuvat 8,5 sekunnissa

Moduulien yläreuna kortin alusta (px), Lauttasaari, puhelin, ensimmäinen
avaus, näytteet 40 ms välein:

| moduuli | 0,07 s | 0,24 s | 2,4 s | 3,0–3,2 s | 8,5 s |
|---|---|---|---|---|---|
| ennusteosion korkeus | 424 | | 436 | | |
| valitun tunnin laattojen korkeus | 228 | 257 | | 228 → 257 | |
| aaltomoduuli | – | | | | ilmestyy, 294 px |
| tuulihavainto | 1 209 | 1 288 | 1 300 | 1 271 → 1 300 | 1 606 |
| kortin viimeinen moduuli | 1 424 | 1 915 | 2 147 | 2 119 → 2 147 | 2 453 |

Jos käyttäjä on jo vierittänyt havaintoihin, sisältö siirtyy hänen
silmiensä edessä seitsemän kertaa, viimeksi 306 px.

#### 8.2.4 Sama tieto moneen kertaan

Puhelin, valittuna nykyhetki, levossa:

| tieto | missä | kertaa |
|---|---|---|
| valitun tunnin tuuli, puuska, suunta | hero; ennusteen lukemarivi | 2 (identtiset) |
| lähde ja ajo ("FMI HARMONIE 2,5 km") | heron aikarivi; valikkokentän alarivi; lukemarivin tuulisolu; kaavion lähdekaista; "Spotti: Ennuste" | 4 + 1 |
| valittu hetki ("klo 13") | heron aikarivi; lukemarivi; laattojen otsikko "NYT KLO 13" | 3 |
| sopivat suunnat (159–251°) | heron päätösrivi; Spotti-moduuli; ⓘ-selite | 2–3 |
| spottiindeksin erittely | ⓘ-selite; Spotti-moduuli | 2 |
| aaltoennuste valitulle tunnille | "Aallot · ennuste" -laatta; aaltomoduulin lukemarivi | 2 |
| viimeisin tuulihavainto | "Tuuli · havainto" -laatta; havaintokaavion lukemarivi | 2 |
| viimeisin vedenlämpö | "Vesi · havainto" -laatta; vedenlämpökaavion lukemarivi | 2 |
| havaintoaseman nimi (Helsinki Laru) | laatta; moduulin otsikko; asemavalitsin; selite | 4 |
| vedenlämmön asema (Lauttasaari) | laatta; moduulin otsikko; asemavalitsin; alaviite | 4 |
| havainnon aika ja ikä | laatan "12:48"; lukemarivin "Viimeisin 12:48"; selitteen "3 min sitten" | 3 |

Kahdennus ei vie vain tilaa — se tuottaa ristiriitoja:

- **Kaavion ennuste ≠ hero.** Kun valikosta valitaan ICON, hero näyttää
  yhä Parasta (6,9 kts, puuska 11,4, indeksi 24) ja heti alla oleva
  lukemarivi ICONia (9,2 kts, puuska 14,1) — sama tunti, sama kortti.
  Valinta tallentuu (`fs_kortti_mallit`), joten ristiriita on pysyvä.
- Saman aseman etäisyys on "0 km" (laatta) ja "0.4 km" (valitsin), sama
  hetki "Nyt 13:00" (aallot) ja "Nyt klo 13" (tuuli), ja samalla rivillä
  on "6.3 kts" ja "2,5 km".
- "Hyvin puuskainen" ja "Mallit eriävät" piirretään `--accent`illa, joka
  on toimintoväri. CLAUDE.md:n mukaan varoitus on `--varoitus` — jäänne
  ajalta ennen Yömerta, jolloin aksentti oli magenta.
- Osuvuusrivillä on lupausteksti ilman dataa ("…näkyy tässä, kun olet
  avannut kortin vielä 4 kertaa eri tunteina").

#### 8.2.5 Kuorma

| mittari | arvo |
|---|---|
| kortin korkeus (390 px) | 2 835 px; pohjalevy 692 px → 4,1 ruudullista |
| näkyviä tekstisolmuja (HTML) | 216 |
| tekstityylejä (koko × paino × väri) | 32 |
| kirjasinkokoja | 10 (11, 12, 13, 14, 17, 18, 20, 21, 22, 38 px) |
| tekstivärejä | 10, joista kolme eri rampin sävyä luvuissa |
| versaalinimiä | 15 |
| laatikoita (oma tausta tai reuna; kaavioiden päiväsoluja ei laskettu) | 24 |
| puoliksi näkyviä kaaviotekstejä levossa | 15: ennuste 7, aallot 3, havainto 3, vedenlämpö 2 (esim. "sade mm/h" 5 % ja 32 %, lähdenimi 2 %, "12.9°" 35 %) |
| ennustekaavion kerroksia | 10: lähdekaista, nuolirivi (24 nuolta / 48 h, umpi tai ontto), 16 lukua / 48 h (tuuli ja puuska), foilausraja ja sen luku, NYT-lappu ja katkoviiva, valitun tunnin kursori ja pallo, yöharso, päiväkaista ja viikonloppusävy, tuntirivi, sadekaista ja sen nimi joka keskiyö |

Ensimmäisessä ruudullisessa (390 × 844) näkyvät hero ja kaavio
päiväriviin asti; sadekaista jää taitteen alle.

### 8.3 Periaatteet

1. **Yksi tieto, yksi paikka.** Sama luku näkyy kortilla kerran. Kaksi
   lukua samasta suureesta sallitaan vain kun ne ovat eri aikaa tai eri
   lähdettä, ja silloin molemmat nimetään (ennuste valitulle tunnille vs.
   havainto nyt — CLAUDE.md:n "ERI RIVIT" -sääntö).
2. **Paikka ei muutu sisällön mukana.** Jokaisella alueella on kiinteä
   korkeus ja jokaisella luvulla kiinteä sarake (tasalevyiset numerot).
   Teksti joka ei mahdu, vaihtuu lyhyempään muotoon (portaikko, kuten
   kaavion päiväotsikossa). Tunnin vaihto, datan saapuminen, kieli ja
   mallien määrä eivät siirrä mitään.
3. **Ei puoliksi näkyviä tekstejä.** Teksti on kokonaan näkyvissä tai
   poissa, ja rajat mitataan — niitä ei arvioida merkkimäärästä.
4. **Lukema on kiinteässä paikassa.** Kaavion osoitin (viiva, pallo,
   mallien pisteet) näyttää *missä* luetaan; luvut ovat aina samassa
   paikassa eivätkä kellu sormen vieressä.
5. **Väri on tieto.** Tuulen ramppi vain tuulen luvuissa ja kaaviossa,
   `--varoitus` vain varoituksissa, kaikki muu kolmella musteella.

### 8.4 Ehdotukset

#### 8.4.1 Lukema: hero on kortin lukema (P10, P11, P13)

- **Hero lukee kaaviota.** Levossa valittu tunti (kuten nyt); kun
  kaaviota osoitetaan (hiiri, pito + liu'utus, nuolinäppäimet), samat
  paikat näyttävät osoitetun tunnin, ja hero saa saman tummemman pohjan
  kuin lukemarivi nyt osoittaessa. Vaihtuvat vain tekstit: luvut, suunta,
  puuska, indeksi ja päätös. Kun sormi nousee, tunti valitaan (kuten nyt);
  ilman valintaa hero palaa valittuun tuntiin.
- **Ennusteosion oma lukemarivi poistuu** kortilta (54 + 6 px).
- **Tiivis lukema yläpalkissa.** Kun hero on vierinyt pois näkyvistä,
  kortin yläpalkkiin (44 px, nyt tyhjä sulkunapin vasemmalla puolella)
  häivytetään yksi rivi samoista paikoista: "Lauttasaari · klo 13 · 6,3
  kts ↗ LO". Lukema on silloin näkyvissä myös kun kaavio on vieritetty
  ruudun yläreunaan — ilman uutta kaistaa.
- **Kupla pois** (P11). Kursoriviiva, pallo ja vertailukäyrien
  väripisteet jäävät, ja tuntirivin pilleri ("Su 16") sanoo hetken.
- **Hero seuraa kaavion ennustetta** (P13). Kun kaavioon on valittu
  malli, heron luvut, indeksi ja päätös ovat sen mallin, ja aikarivi
  nimeää mallin ("· ICON"). Paras-tilassa kaikki on kuten nyt: hero =
  spottimerkki = aikajana (kortti vs aikajana 0,0000 m/s säilyy).
- **Laajassa** lukemarivi jää ainoaksi lukemaksi, ja levossa se näyttää
  valitun tunnin eikä 48 h:n keskiarvoja, jotta solut eivät vaihdu levon
  ja osoituksen välillä.

#### 8.4.2 Laaja: mallit valikkoon, selite lukemariville (P12)

- "Lisää"-sirurivi korvataan yhdellä napilla **"Vertaa ⌄"** (valitut
  lukumääränä: "Vertaa · 3"). Se avaa `Valikko`n valintaruuduin
  (monivalinta, enintään kolme; neljäs on pois käytöstä ja kertoo miksi).
- **Valitut mallit ovat lukemarivin soluja:** viivanäyte samalla värillä
  ja kuviolla kuin käyrä (identiteetti on aina myös kuviossa), nimi ja
  arvo. Rivi on samalla selite, eikä sirurivin selitettä tarvita.
- **Korkeus ei riipu mallien määrästä:** vaakaruudussa (leveys ≥ 600 px)
  yksi rivi, 54 px, myös kolmella mallilla; pystyssä aina kaksi riviä,
  80 px (toinen rivi ilman malleja: hiljainen "Vertaa malleja ⌄").
- **Solut ovat kiinteitä sarakkeita** (leveys pisimmästä mahdollisesta
  arvosta, tasalevyiset numerot): luku ei siirry vaakaan tunnista toiseen.
- **Lähde pois tuulisolun nimestä** ("Tuuli · FMI HARMONIE 2,5 km" →
  "Tuuli"): lähdekaista kertoo sen.

#### 8.4.3 Kiinteät mitat

| alue | nyt | ehdotus |
|---|---|---|
| hero | 180–200 px rivitysten mukaan | Kiinteä korkeus; jokainen rivi on yksi rivi. Lähde ja ajo pois aikariviltä (ne ovat lähdekaistassa). Puuskarivi "Puuska 10,1 kts · ×1,6"; sana "hyvin puuskainen" päätösrivillä vain varoituksena. Päätösrivin selite lyhyessä muodossa kun pitkä ei mahdu ("42° sivussa"). |
| ennusteen otsikko ja valikko | otsikkorivi 48 px + valikkokenttä 50 px (nimi ja alarivi) | Yksi rivi: valikkokenttä (vain nimi) vasemmalla, Nyt ja laajennus oikealla; Nyt-napin paikka varataan myös piilossa. Ryhmän nimi "Tuuliennuste" kortin ulkopuolelle kuten muissa ryhmissä. |
| kaavio | 222 tai 242 px sadekaistan mukaan; paikanpitäjä 230 px | Sadekaista aina kortilla (18 px). Paikanpitäjä ja "ei saatu" -viesti ovat kaavion korkuisia; ennusteen vaihdossa edellinen kaavio jää himmennettynä paikalleen kunnes uusi on valmis (kuten sadekerroksen hyppy). Vihje "Pidä sormea kaaviolla…" kaavion päälle häivytettynä, ei sen alle. |
| valitun tunnin laatat | 210–382 px | Kiinteä 2 × 2 -ruudukko (ilma, puku, vedenkorkeus, aurinko), kiinteä laattakorkeus: nimi, arvo ja kaksi varattua alariviä. Laattajoukko päätetään spotin datasta kerran (P14); tunnilta puuttuva arvo on "—" ja syy ("ei ennustetta tälle tunnille"). |
| myöhään tulevat moduulit | ilmestyvät datan tullessa | Korkeus varataan heti (luuranko lopullisilla mitoilla). Aaltomoduuli vain spoteille joilla WAM on: kolme spottia on mallin maamaskissa, ja se voidaan tietää etukäteen (spottitieto tai ensimmäisen haun muisti). |
| laajan lukemarivi | 54 tai 80 px mallien mukaan | Kiinteä suunnan mukaan (8.4.2). |

#### 8.4.4 Kahdennukset pois — poistolista (P15)

| # | poistuu | tieto jää |
|---|---|---|
| 1 | ennusteosion lukemarivi (P10) | hero, ja yläpalkin tiivis lukema kun hero ei näy |
| 2 | "Havainnot nyt" -laatat: tuuli, ilma, vesi | havaintokaavion ja vedenlämpökaavion lukemarivit (viimeisin); ilma havaintokaavion rivillä kun asemalla on lämpömittari |
| 3 | "Aallot · poiju" -laatta | yksi rivi aaltomoduulin alle: "Poiju nyt 0,3 m · Helsinki Suomenlinna 7 km · 81 min sitten" (eri aikaa kuin ennuste, joten eri rivi) |
| 4 | "Aallot · ennuste" -laatta | aaltomoduulin lukemarivi (valittu tunti) |
| 5 | "Spotti"-moduuli kokonaan | indeksin erittely ⓘ-selitteessä; sopivat suunnat päätösrivillä ja selitteessä; lähde lähdekaistassa |
| 6 | lähde heron aikariviltä ja valikkokentän alariviltä | kaavion lähdekaista; ajon aika sen ensimmäisen nimen perään ("HARMONIE 2,5 km · ajo 09") |
| 7 | havaintoaseman nimi moduulin otsikosta ja selitteestä | asemavalitsin |
| 8 | vedenlämpöaseman nimi otsikosta ja alaviitteestä | asemavalitsin; alaviitteeseen jää "UiRas" |
| 9 | laattaryhmän otsikon kellonaika ("NYT KLO 13") ja laattojen "· ennuste" -päätteet | hero tai yläpalkki kertoo hetken; ryhmän nimi "Valitulla tunnilla" |
| 10 | osuvuuden lupausteksti | rivi näkyy vasta kun dataa on |
| 11 | "sade mm/h" jokaisen keskiyön kohdalla | kerran kiinteällä akselilla ("mm"), kuten "kts" |
| 12 | (valinnainen) kortin yläreunan tuulisävy (`_shSavy`), joka vaihtaa väriä joka tunnilla | iso luku on jo tuulen värinen |

Arvio (ei mitattu): kortti 2 835 → noin 2 200 px ja laatikoita 24 →
noin 15, ja 390 px:n puhelimella hero ja koko kaavio sadekaistoineen
mahtuvat ensimmäiseen ruudulliseen.

#### 8.4.5 Kaavion keventäminen (P16)

Kortin kaavio on pieni (48 h noin 350 px:llä), ja se on täynnä; laaja on
yksityiskohtia varten.

- **Kortilla vain tuulen luvut** huipuissa ja laaksoissa; puuskan luvut
  laajassa. Puuska näkyy kortilla vyöhykkeenä ja herossa lukuna. 16 → 8
  lukua / 48 h.
- **Nuolet 3 h välein**, samassa rytmissä lukujen kanssa (24 → 16 /
  48 h); umpi/ontto-ero (suunta sopii) säilyy.
- **Lähdekaistan nimet tarttuviksi** kuten päiväotsikko (V4): nimi vain
  lähteen vaihtuessa, se pysyy näkyvissä koko jakson ajan, ei toistu
  joka keskiyö eikä leikkaudu reunasta ("N-EU 7 km").
- **Ei puoliksi näkyviä tekstejä:** y-akselin liuskan alle osuva tai
  reunan yli menevä luku piilotetaan, tuntirivin pilleri piilottaa alleen
  jäävän tuntiluvun, ja NYT-lappu väistää akselin yksikköä.
- Koska moottori on yksi, korjaukset koskevat kaikkia neljää kaaviota ja
  laajaa (`tools/graafimittaus.mjs` regressiona).

#### 8.4.6 Typografia ja väri

- Kuusi kirjasinkokoa kortissa (11, 13, 15, 17, 22 ja heron 38 px),
  kolme mustetta (`--ink`, `-2`, `-3`), rampin väri vain tuulen luvuissa
  ja `--varoitus` vain varoituksissa (korjaa "hyvin puuskainen" ja
  "Mallit eriävät").
- Moduulin sisällä ei sisäkkäisiä täytettyjä laatikoita lukemille:
  lukemarivit (havainto, vesi, aallot, laaja) ovat tekstiä moduulin
  pinnalla, ja osoituksen tila näkyy aikasolun korostuksena.
- Versaalit vain ryhmien nimissä.
- Yksi aikamuoto kaikissa kaavioissa ("klo 13" tai "13:00", valitaan
  kerran) ja yksi etäisyyden pyöristys.
- Desimaalierotin yhdeksi (P17).

#### 8.4.7 Tavoitekuva

Puhelin (390 px), kortin alku:

```
┌────────────────────────────────────────────┐
│ ▬   Lauttasaari · klo 13 · 6,3 kts ↗ LO   ✕│  yläpalkki: tiivis lukema vain kun
│                                            │  hero on vierinyt pois näkyvistä
│ Lauttasaari                          ☆  ⇪  │
│ Etelä–länsi, helppo pääsy                  │
│ ┌────────────────────────────────────────┐ │
│ │ NYT  La 3.10. klo 13           ╭──╮    │ │  HERO = kaavion lukema:
│ │ 6,3 kts                        │21│    │ │  kiinteä korkeus,
│ │ ↗ 203° · lounaasta             ╰──╯    │ │  rivit eivät rivity
│ │ Puuska 10,1 kts · ×1,6   spottiind. ⓘ  │ │
│ │ [Liian heikko]  Suunta osuu            │ │
│ │ Mallit yksimielisiä ±1,3 kts           │ │
│ └────────────────────────────────────────┘ │
│ TUULIENNUSTE                               │
│ ┌────────────────────────────────────────┐ │
│ │ [Paras saatavilla ⌄]       [Nyt]  [⤢]  │ │  yksi rivi
│ │ HARMONIE 2,5 km · ajo 09 ─ ECMWF 9 km  │ │  tarttuva lähdekaista
│ │ ↗    ↗    ↗    ↗    ↗    ↗    ↗    ↗   │ │  nuolet 3 h välein
│ │ (kaavio: tuulen luvut, puuska alueena) │ │
│ │ 06   12   18   00   06   12   18   00  │ │
│ │ Tänään 3.10.     │ Sunnuntai 4.10.     │ │
│ │ mm   ▁▂                                │ │  sadekaista aina
│ └────────────────────────────────────────┘ │
│ VALITULLA TUNNILLA                         │
│ [Ilma 12 °C]          [Puku 4/3 mm]        │  2 × 2, kiinteä korkeus
│ [Vedenkorkeus +9 cm]  [Aurinko 07:30–18:47]│
│ AALLOT     lukemarivi · kaavio · poiju nyt │
│ HAVAINNOT  tuuli: valitsin · rivi · kaavio │
│            vesi: valitsin · rivi · kaavio  │
│ [Reittiohje]   Avaa Wazessa                │
└────────────────────────────────────────────┘
```

Laaja vaakaruudussa (844 × 390):

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Lauttasaari    [Paras saatavilla ⌄]   [Vertaa · 3 ⌄]                              [−] [+]  ✕   │
│ Su 4.10. klo 14 │ Tuuli 12,0 kts ↗ LO │ Puuska 17,4 │ ━ ECMWF 12,8 │ ╍ ICON 13,6 │ ┈ GFS 14,2  │
│ (kaavio: korkeus sama 0–3 mallilla; kursori, pallo ja mallien pisteet osoittavat kohdan)       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.5 Päätettävät kohdat

**P10 — Kortin lukema.**
- **A (suositus):** hero on ennustekaavion lukema (8.4.1). Kortin oma
  lukemarivi poistuu, ja kun hero on vierinyt pois, yläpalkissa on tiivis
  lukema. Seuraus: ei kahdennusta, 60 px vähemmän, ja osoittaessa vain
  tekstit vaihtuvat.
- **B:** lukemarivi jää, mutta levossa se näyttää seuraavan 48 h:n
  yhteenvedon (kovin tuuli ja milloin, foilattavat tunnit) eikä samaa
  kuin hero. Ei kahdennusta, mutta kaista jää.
- **C:** nykyinen.

**P11 — Kupla pallon vieressä** (30.9. pyyntö "lukema voisi näkyä pallon
vieressä ja myös muilla malleilla").
- **A (suositus):** pois kortilta ja laajasta. Lukema on kiinteässä
  paikassa (hero, laajan lukemarivi), ja kursori, pallo ja mallien
  väripisteet näyttävät kohdan. Pyynnön "myös muilla malleilla" -osa
  toteutuu laajan lukemarivillä. Kupla toisti rivin luvut, vaihtoi
  kokoaan ja puoltaan ja peitti käyrät juuri siinä kohdassa jota
  luetaan.
- **B:** jää, mutta kiinteän kokoisena (leveys koko sarjan pisimmästä
  tekstistä, mitattuna), yksirivisenä (vain pääsarjan luku) ja puolen
  vaihto kynnyksellä.

**P12 — Laajan vertailumallien valinta.**
- **A (suositus):** "Vertaa ⌄" -valikko, ja valitut mallit lukemarivin
  soluina (8.4.2).
- **B:** sirurivi jää, mutta omalle rivilleen ja rivittyvänä joka
  laitteella. Vie vaakaruudussa kaaviolta 36 px.

**P13 — Mitä hero näyttää kun kaavioon on valittu malli.**
- **A (suositus):** saman mallin luvut, indeksin ja päätöksen;
  aikarivillä mallin nimi. Valinta pysyy tallennettuna kuten nyt, ja hero
  kertoo aina mistä luku on.
- **B:** hero näyttää aina Parasta. Silloin kaavion lukema tarvitsee oman
  rivinsä (P10 B tai C), ja kortilla on kaksi lukua samalle tunnille.

**P14 — Valitun tunnin laatat.**
- **A (suositus):** kiinteä ruudukko; laattajoukko päätetään spotin
  datasta kerran, ja tunnilta puuttuva arvo on "—" ja syy. Tämä tarkentaa
  sääntöä "viiva olisi lupaus datasta jota ei ole": laattaa ei näytetä
  spotille jolle dataa ei ole koskaan, mutta yksittäisen tunnin aukko
  sanotaan.
- **B:** laatat piiloutuvat kuten nyt (korkeus vaihtelee tunnista
  toiseen).

**P15 — Poistolista 8.4.4.** Hyväksy kohdittain. Suositus: kohdat 1–11;
kohta 12 on makuasia.

**P16 — Kortin kaavion keventäminen (8.4.5).**
- **A (suositus):** kaikki neljä kohtaa.
- **B:** vain puoliksi näkyvät tekstit ja tarttuva lähdekaista; luvut ja
  nuolet ennallaan.

**P17 — Desimaalierotin suomeksi.** Nyt lukemat ovat pisteellä ("6.3
kts") ja kiinteät nimet pilkulla ("2,5 km").
- **A (suositus):** pilkku kaikissa suomenkielisissä luvuissa koko
  sovelluksessa (kortti, kapseli, aikajana, kaaviot), englanniksi piste.
  Tarkistus DOMin tekstistä samaan tapaan kuin kielen tarkistus.
- **B:** piste kaikkialla, myös lähdenimissä ("2.5 km").
- **C:** nykyinen sekoitus.

### 8.6 Vaiheet

Jokainen vaihe on oma committinsa ja viedään oletushaaralle
(`claude/vite-project-setup-6je1pq`) kun sen mittaukset ovat kunnossa;
jokainen päivittää tämän luvun mittauksineen ja CLAUDE.md:n säännöt
päätösten mukaan (8.8).

**V12 — Mittari `tools/korttimittaus.mjs`** (ei näkyvää muutosta). Kortti
ja laaja puhelimilla 320–430 px pystyssä ja 667/844 px vaakassa,
iPadilla ja työpöydällä, suomeksi ja englanniksi; mallisarjat
istutetaan `KorttiSarjat._m`:ään (sääntö "MALLIDATAA EI MITATA
VERKOSTA"). Jokainen rivi `ok`/`VIKA` kuten graafimittauksessa: puoliksi
näkyvät ja leikatut tekstit, korkeudet 127 tunnin yli, laajan rivi 0–3
mallilla levossa ja osoittaessa, avauksen siirtymät 10 s:n ajan,
kahdennukset hakusanoina ja tyylien määrä. Nykytila (8.2) on lähtötaso.
*Koko: pieni–keskitaso. Riski: ei.*

**V13 — Laaja** (pyynnön näkyvin vika ensin). Vertaa-valikko (P12),
mallit lukemarivin soluina viivanäytteineen, kiinteä rivi suunnan
mukaan, levossa valittu tunti, kupla P11:n mukaan; mallien väripisteet
jäävät. *Mitataan:* valittujen mallien nimet ja arvot 100 % näkyvissä
kaikilla laitteilla ja kielillä; lukemarivin ja kaavion korkeus sama 0–3
mallilla, levossa ja osoittaessa. *Koko: keskitaso. Riski: pieni.*

**V14 — Hero ja ennusteosio.** Heron kiinteät paikat ja lyhyet muodot,
hero lukee kaaviota (P10) ja seuraa sen ennustetta (P13), yläpalkin
tiivis lukema, yksirivinen valikkorivi, lähde ja ajo lähdekaistaan,
kaavion kiinteä korkeus (sadekaista, paikanpitäjä, edellinen kaavio
himmennettynä), vihje kaavion päälle ja varoitusvärit. *Mitataan:*
heron ja ennusteosion korkeus sama 127 tunnin, kaikkien leveyksien,
kielten ja ennustevalintojen yli; kortti vs aikajana 0,0000 m/s ja
spottimerkki = kortin indeksi Paras-tilassa; WebKit-napautus ja pito +
liu'utus (V6:n ja V10:n mittarit). *Koko: suuri. Riski: keskitaso*
(heron päivityspolku ja osoitin).

**V15 — Kortin alaosa.** Poistolista (P15), laattaruudukko (P14), varatut
korkeudet myöhään tuleville moduuleille, aseman nimi ja ikä kerran,
Spotti-moduuli ja osuvuuden lupausteksti pois. *Mitataan:* laattojen
korkeus sama 127 tunnin yli, moduulien paikat eivät muutu ensimmäisen
maalauksen jälkeen, kahdennusten määrät (8.7). *Koko: keskitaso. Riski:
pieni.*

**V16 — Kaavio ja typografia.** Kaavion keventäminen (P16) kaikissa
kaavioissa, kirjasinkoot, värit, sisäkkäiset laatikot, versaalit,
aikamuoto ja desimaalierotin (P17). *Mitataan:* puoliksi näkyviä
tekstejä 0, `tools/graafimittaus.mjs` läpi, kontrastimittari kuten
Yömeressä ja `?kieli=en`-tarkistus. *Koko: keskitaso. Riski:
pieni–keskitaso* (koskee kaikkia kaavioita).

```
V12 ─┬─ V13
     ├─ V14 ── V15
     └──────── V16
```

### 8.7 Hyväksymismittarit

| mittari | nyt | tavoite |
|---|---|---|
| valittujen mallien nimet ja arvot näkyvissä laajassa (kaikki laitteet, fi/en) | puhelimilla ICON 0–14 %, GFS 0 % | 100 % |
| laajan lukemarivin korkeus 0–3 mallilla, levossa ja osoittaessa | 54 / 80 px | yksi arvo suuntaa kohti |
| heron korkeus 127 tunnin yli, 320–430 px, fi/en | 375 px: 4 arvoa, 44 muutosta | 1 arvo |
| ennusteosion korkeus ennusteen vaihdossa (myös lataus ja "ei saatu") | 406 / 418 / 436 px | 1 arvo |
| valitun tunnin laattojen korkeus 127 tunnin yli | 7–9 arvoa, 20 muutosta | 1 arvo |
| moduulien siirtymät ensimmäisen maalauksen jälkeen | 7 siirtoa, suurin 306 px | 0 |
| puoliksi näkyviä tai leikattuja tekstejä kortissa ja laajassa | 15 kaaviotekstiä + mallirivi | 0 |
| sama tieto kortilla (lähde, asemanimi, valitun tunnin luvut) | 2–5 kertaa | kerran (eri aika tai lähde nimettynä) |
| kortin korkeus 390 px:llä | 2 835 px | ≤ 2 300 px |
| tekstityylejä / kirjasinkokoja / tekstivärejä / laatikoita | 32 / 10 / 10 / 24 | ≤ 14 / 6 / 6 / 15 |
| ensimmäinen ruudullinen (390 × 844) | hero ja kaavio ilman sadekaistaa | hero ja koko kaavio |
| regressiot: savutesti, graafimittaus, kortti vs aikajana, merkki = indeksi | läpi | läpi |

### 8.8 CLAUDE.md:n säännöt joihin tämä koskee

- **"KAAVION LUKEMA ON KIINTEÄLLÄ RIVILLÄ … JA OSOITETTAESSA MYÖS
  KUPLASSA PALLON VIERESSÄ"** — P10 A tekee kortin ennustekaavion
  lukemaksi heron (kiinteä paikka säilyy, rivi poistuu kortilta), P11 A
  poistaa kuplan. Havainto-, vedenlämpö- ja aaltokaavioiden rivit jäävät.
- **"RIVI EI RIVITY EIKÄ KASVA: YKSI RIVI, 54 px"** — säilyy; laajan rivi
  on kiinteä suunnan mukaan.
- **"KORTIN ENNUSTE VALITAAN VALIKOSTA, PÄÄLLE LISÄTÄÄN VAIN LAAJASSA"**
  ja sen "Lisää"-sirurivi — P12 A korvaa sirurivin Vertaa-valikolla;
  säännön ydin (pohja kortilla, vertailut vain laajassa, enintään kolme)
  säilyy.
- **"SPOTTIKORTTI JA SPOTTIMERKIT LUKEVAT SAMAA SEKOITUSTA KUIN KARTTA"**
  — pätee Paras-tilassa; P13 A:lla hero voi näyttää valitun mallin, ja se
  nimetään.
- **"ASEMAN NIMI SANOTAAN KERRAN, IKÄ SANOTAAN KERRAN"** — laajenee koko
  korttiin (P15).
- **"Aaltoennuste ja poijuhavainto ovat ERI RIVIT"** — säilyy: poiju on
  oma rivinsä aaltomoduulissa.
- **"viiva olisi lupaus datasta jota ei ole"** (aalto- ja vesilaattojen
  kommentit) — P14 A tarkentaa: koskee spottia, ei yksittäistä tuntia.
- **"MAGENTA ON VAIN VAROITUS"** — kaksi `--accent`-jäännettä korjataan.
- **P6 (sadekaista kyllä)** — säilyy, mutta kaista on aina varattu.

### 8.9 Mitä EI ehdoteta

- **Ei uutta dataa eikä uusia osia.** Esimerkiksi "seuraava hyvä keli"
  -yhteenvetolause olisi hyödyllinen, mutta se on uusi tekstielementti;
  harkitaan vasta kun kortti on rauhoitettu (P10 B on sen kevyt muoto).
- **Ei aikajanan muutoksia.** Aikajana on lukittu; kortti mukautuu
  siihen.
- **Ei heron ison luvun eikä indeksin poistoa.** Ne ovat päätöksen
  ankkurit.
- **Ei aaltokaavion poistoa** (1.10. pyyntö) — vain sen kahdennukset.
- **Ei leveämpää sivupaneelia** (sääntö: kaikki kolme paneelia 400 px).
- **Ei avattavia haitareita oletuksena.** Ne vaihtaisivat kortin
  korkeutta napautuksesta, ja juuri sitä tässä poistetaan.
- **Ei uutta kaaviomoottoria:** muutokset tehdään yhteiseen moottoriin
  (`Tuulikaavio`, `Aikakaavio`) ja kortin rakenteeseen.

### 8.10 Toteutus ja mittaukset (3.10.2026)

Jokainen vaihe on oma committinsa oletushaaralla. Luvut ovat
`tools/korttimittaus.mjs`:n (V12) rivejä; "lähtötaso" on strategian
commit `4537c80` samalla mittarilla ja samalla istutetulla datalla.

#### V12 — mittari `tools/korttimittaus.mjs`

Pysyvä mittari kortille ja laajalle, samaan tapaan kuin
`tools/graafimittaus.mjs`: jokainen rivi `ok`/`VIKA`, poistumiskoodi 1
vialla, osat valittavissa (`--osat=laaja,tunnit,vaihto,lukema,avaus,
teksti,kahdennus,tyyli,regressio`, `--nopea`, `--kuvat=kansio`).

**Data istutetaan, ei haeta.** Sääntö "MALLIDATAA EI MITATA VERKOSTA"
on mitattu syy: sama build antoi peräkkäin 75 ja 0 malliviivaa, ja
`KorttiSarjat._avain` sisältää tunnin, joten kesken mittauksen
vaihtuva tunti laski sarjat uudelleen ja mallit olivat hetken "ei
saatu" (näin kävi strategian mittauksessa klo 13:00). Mittari kirjoittaa
spotin kuusi sarjaa (`paras`, `fmi`, `metnordic`, `ecmwf`, `icon`,
`gfs`) `KorttiSarjat._m`:ään, kiinnittää avaimen ja korvaa spotin oman
sääsarjan (`spot.wx`: sade, lämpö, pilvet). Sarjat ovat synteettisiä
mutta kattavat kortin tilat: tyyni jakso (+30 h), rajatuuli, hyvä,
kova ja liian kova (myrsky +100 h, kortin ja laajan oletusikkunan
ulkopuolella), puuskasuhde 1,15–1,70 ("hyvin puuskainen" mukana),
suunta kiertää koko kehän noin 50 tunnissa, ja sadetta kahdessa
jaksossa. Havainnot, aallot ja vedenkorkeus tulevat verkosta — ne ovat
juuri niitä myöhään saapuvia moduuleita joiden siirtymät avauksessa
mitataan. Kontin Chromium ei luota välityspalvelimen varmenteeseen,
joten konteksti on `ignoreHTTPSErrors` (ilman sitä varasto ei
latautunut ja MapLibre heitti `signal`-virheitä).

**Laitteet:** puhelimet 320, 360, 375, 390, 414 ja 430 px pystyssä,
667 ja 844 px vaakassa, iPad 820 px ja työpöytä 1 440 px; suomi ja
`?kieli=en`; kaikissa `hasTouch` paitsi työpöydällä, ja
`reducedMotion: 'reduce'` (liu'ut eivät ole mitattava asia).

**Miksi ei CI:ssä:** täysi ajo kestää 18 min, ja avauksen mittaus on
oikeiden palveluiden ajoituksen mittaamista. Regressiorivi "kortin
Paras = aikajana" ajetaan oikealla datalla ilman istutusta, ja se
ohitetaan (ei VIKA) jos varasto ei vastaa.

**Lähtötaso** (`4537c80`, 150 VIKAA, 1 089 s):

| osa | lähtötaso |
|---|---|
| laaja: lukemarivi 0–3 mallilla | 62 / 88 px kaikilla 12 laitteella (rivi 54 / 80 + täyte) |
| laaja: kaavio | lyhenee 26 px ensimmäisestä mallista (vaaka 844: 247 → 221 px) |
| laaja: valittujen mallien solut näkyvissä | 28–80 % (mallirivin 17 px:n laatikko leikkaa, englanniksi GFS 28–50 %) |
| laaja: mallien valinta (sirut) | puhelimilla ICON 0–14 %, GFS 0 %; vaaka 667 px kaikki 0 % |
| laaja: lukemarivin solujen paikat | 4–6 asettelua |
| laaja: kupla | kaksi leveyttä mallimäärää kohti (esim. 118 / 125 px), 320 px:llä 4/20 osoitusta reunan yli (19 px) |
| tunnit: heron korkeus | 320 px 6 arvoa (188–224 px), 360 px 4, 375 px 5, 320 px en 8, 390 px en 2, työpöytä 7; 390–430 px suomeksi 1 |
| tunnit: ennusteosio | 436 tai 448 ↔ 418 px (sadekaista), kaikilla |
| tunnit: valitun tunnin laatat | 6–11 arvoa, 16–26 muutosta |
| tunnit: kaavion paikka | sama kuin heron vaihtelu (320 px: 6 arvoa, 16 muutosta) |
| vaihto: ennusteosio | 424 → 436 px latauksessa (paikanpitäjä), "ei saatu" 424 px |
| lukema | hero ei seuraa osoitusta, ICON-kaavio ei muuta heroa, kortilla oma lukemarivi, ei tiivistä lukemaa |
| avaus | 22 (puhelin) ja 24 (työpöytä) moduulien siirtymää, suurin 1 077 / 1 123 px |
| teksti: puoliksi näkyviä | 8–9 levossa, 9–12 kaaviot vieritettyinä; 320 px:llä katkaistu "Tuuli · FMI HARMONIE 2,5 km" |
| kahdennus | valitun tunnin tuuli 2, puuska 2, lähde 4, havaintoasema 4, vedenlämpöasema 5, hetki 3 kertaa |
| tyyli | 31 tekstityyliä, 10 kirjasinkokoa, 10 väriä, 31 laatikkoa, 13 versaalia; kortti 2 847 px; ennusteosion alareuna 696 px kun näkyvää on 648 |
| regressio | ok: hero = Paras (5 tuntia), merkki = heron indeksi, kortti = aikajana 0,0000 m/s oikealla datalla |

Luvut eroavat luvun 8.2 käsin mitatuista, koska data on eri: 8.2 oli
3.10. klo 12–13 oikea data, mittari istuttaa saman synteettisen datan
joka ajolla. Esimerkiksi hero 375 px:llä oli oikealla datalla neljää
korkeutta ja istutetulla viittä — vika on sama, ja mittarin luku on
toistettava.

