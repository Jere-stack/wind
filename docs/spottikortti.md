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
