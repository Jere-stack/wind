# Asetukset paikan mukaan — strategia (10.10.2026)

Käyttäjän pyyntö 10.10.: "kun ollaan esimerkiksi Ranskassa katsomassa
paikallisia datoja, asetuksen säämallit ja kytkimet eri lähteiden
havaintoihin eivät osu paikalliseen dataan … asetukset täsmäävät, eikä
siellä ole alueelle turhia datapisteitä, jotka eivät ole mahdollisia
sillä alueella."

Tämä on strategia. Mitään ei ole vielä toteutettu. Nykytila on luettu
koodista (rivinumerot 10.10. `index.html`ssä) ja lähteiden kattavuus
koodista ja aiemmista mittauksista. Selaimessa ei ole vielä mitattu
mitään: luvut ovat mittarin (luku 7) ensimmäinen tehtävä.

---

## Tiivistelmä

**Diagnoosi.** Asetuspaneeli on kirjoitettu Suomeen. Kartta, kapseli,
aikajana ja kortti valitsevat jo lähteen paikan mukaan (Paras saatavilla,
E-SOH-asemat, sade ECMWF:llä tutkan ulkopuolella), mutta paneeli on
staattista HTML:ää, jonka rivit ja tekstit ovat samat joka paikassa.
Ranskan rannikkoa katsottaessa paneelin 20 valinnasta **kuusi ei tee
näkymässä mitään ja kaksi kertoo väärästä paikasta** (luku 2), ja Ranskan oma
malli (AROME HD 1,3 km) puuttuu valikosta kokonaan, vaikka se on kartan
pääsarja.

**Suositus: vaihtoehto C, "paneeli lukee saman katteen kuin kartta".**
Yksi katerekisteri (`Kate`) kertoo jokaiselle paneelin valinnalle,
kattaako sen lähde nykyisen näkymän. Rekisteri ei kirjoita katetta
käsin: mallien kate tulee varaston luettelosta ja painokanavasta (sama
`malliKohdassa` kuin lähdemerkinnällä), tutkan `TutkaKate`sta, aaltojen
luettelon `aallot`-tasoista ja havaintojen asemaluetteloista. Paneeli:

1. **näyttää vain näkymässä mahdolliset rivit**, ja muut kootaan
   suljettuun riviin "Muualla saatavilla (n)" — mitään ei poisteta eikä
   tallennettua valintaa muuteta;
2. **rakentaa mallilistan luettelosta**: Paras saatavilla, näkymän
   alueelliset mallit (Ranskassa AROME HD, Bretagnessa myös UKV:n reuna),
   ja maailman mallit ECMWF, ICON ja GFS;
3. **kirjoittaa alatekstit paikasta**: "Paras saatavilla — täällä AROME HD
   · ECMWF", "Tuuliasemat · rannikko — Météo-France, 41 asemaa
   näkymässä".

Kerrosruudut (Tuuli, Puuska, Aallot, Sade) pysyvät neljänä ruutuna, mutta
katteeton ruutu sanoo sen ruudussa eikä vaihda kartalle tyhjää.

Vaiheet V1–V5 (luku 6), hyväksymismittari luvussa 7 ja päätettävät kohdat
P1–P6 luvussa 8.

---

## 1. Periaatteet

- **P-a. Kate tulee datasta, ei listasta.** Sovelluksessa on jo
  luettelot joissa kate on: varaston tasojen `lat`/`lng` ja painokanava,
  `TutkaKate.ASEMAT`, WAM-tasot, `FMI_MAP_STATIONS` ja UiRaS-asemat,
  E-SOH:n `esoh/asemat.json`. Käsin kirjoitettu "Ranskassa on X" -taulukko
  olisi kopio, ja kopio on tässä repossa vanhentunut kahdesti
  (`_fmiStationsSorted`, CLAUDE.md "ASEMAREKISTERI ON YKSI").
- **P-b. Paikka on kartan näkymä, ei laitteen sijainti.** Helsingissä
  istuva joka suunnittelee Bretagnen matkaa, haluaa Bretagnen valinnat.
  Sama sääntö kuin kapselissa ja lähdemerkinnässä (tähtäin, ei GPS).
- **P-c. Piilotus on esitystä, ei tilaa.** `fs_tasot` ja muut tallennetut
  valinnat eivät muutu alueen mukana. Ranskasta Helsinkiin palaava löytää
  rantalämpötilat siinä tilassa johon ne jätti. Jos katteeton rivi
  kytkettäisiin pois, matka muuttaisi asetuksia.
- **P-d. Ei uutta funktiota.** API-funktioita on 12/12 (Vercelin Hobby-
  katto). Kaikki tässä on asiakkaan laskentaa olemassa olevasta datasta.
- **P-e. Kaikki säännöt pätevät myös dynaamisiin riveihin**: teksti
  kahdesti (`_t`, `data-en`), mallin- ja paikannimiä ei käännetä,
  radiogroup ja roolit rakenteesta, Esc ja `Modaali`, desimaalipilkku.
- **P-f. Paneeli ei hypi käden alla.** Sivupaneelitilassa (≥ 740 px)
  paneeli on auki kartan vieressä. Rivit päivittyvät vasta `moveend`issä,
  eikä fokuksessa olevaa riviä poisteta kesken.

---

## 2. Nykytila — mitä paneelissa on ja mitä se tekee Ranskassa

Paneelin rakenne (`#settings-popup`, rivit 5311–5525): Kieli · Kartta
(kerros, yksikkö, pohjakartta, lämpökartta, partikkelit) · Kartan malli
(6 vaihtoehtoa) · Havainnot kartalla (5 kytkintä) · Tietoa.

| valinta | lähde ja kate | Ranskan rannikolla (esim. Quiberon) |
|---|---|---|
| Kerros **Tuuli**, **Puuska** | varasto, koko maailma | toimii (AROME HD + ECMWF) |
| Kerros **Aallot** | FMI WAM, `tools/wam.mjs` BBOX 9–30,5° E, 53–66,85° N | **tyhjä kartta**; asteikon teksti "FMI:n WAM-aaltomalli" |
| Kerros **Sade (beta)** | tutka `TutkaKate` (Suomi), HARMONIE (MEPS), muualla ECMWF 9 km | toimii ECMWF:llä, mutta teksti kertoo Suomen tutkasta |
| Yksikkö, pohjakartta, lämpökartta, partikkelit | ei alueriippuvuutta | toimii |
| Malli **Paras saatavilla** | kaikki alueelliset + ECMWF | toimii (AROME HD), mutta alateksti on kiinteä **"FMI · MET Nordic · ECMWF"** (rivi 5438) |
| Malli **HARMONIE** | Suomi ja lähialueet, ~66 h | **kartalla ECMWF** — valinta ei tee näkymässä mitään |
| Malli **MET Nordic** | Pohjoismaat, Baltia, Luoteis-Venäjä | **kartalla ECMWF** |
| Malli **ECMWF**, **ICON**, **GFS** | maailma (ICON-EU 7 km Euroopassa) | toimii |
| — (puuttuu) | AROME HD ja muut 9 alueellista (`tools/alueelliset.mjs`) | **paikan oma malli ei ole valittavissa** |
| Kytkin **Tuuliasemat · rannikko** | FMI-rekisteri + E-SOH | toimii; alateksti "Harmaja, Laru…" |
| Kytkin **FMI · Aaltopoijut** | FMI:n poijut, Suomi | **ei yhtään merkkiä** |
| Kytkin **Rantalämpötilat** | UiRaS, pääkaupunkiseutu | **ei yhtään merkkiä** |
| Kytkin **Tuuliasemat · sisämaa** | FMI-rekisteri + E-SOH | toimii; alateksti "Kaisaniemi, Kumpula…" |
| Kytkin **Muut uimapaikat** | UiRaS, pääkaupunkiseutu | **ei yhtään merkkiä** |

Kuuden kuolleen valinnan (Aallot-kerros, HARMONIE, MET Nordic, poijut ja
kaksi UiRaS-kytkintä) ja kahden harhaanjohtavan (Paras saatavilla, Sade)
lisäksi kaksi asemarivin alatekstiä puhuu Suomesta ("Harmaja, Laru…", "Kaisaniemi, Kumpula…", sateen ja
aaltojen asteikkotekstit). Mallikuvaus (`_malliVihje`, rivi 34462) kertoo jo
"Nyt kartan keskellä: AROME HD" — eli oikea tieto on olemassa, mutta se on
listan alla pienellä eikä vaikuta listaan.

**Sama vika on spottikortin mallivalikossa** (`KorttiSarjat.MALLIT`,
rivi 23543): HARMONIE, MET Nordic, ECMWF, ICON, GFS. Ranskan spotilla
kaksi ensimmäistä antavat "ei sarjaa" ja AROMEa ei voi valita
vertailuun. Se ei ole asetuspaneeli, mutta käyttäjälle sama kysymys
("mitkä mallit täällä on"), joten sama rekisteri ratkaisee sen (V5).

**Mitä ei tarvitse korjata:** kapselin vasen osa (Aallot / Tuulen suunta)
putoaa jo itse tuulen suuntaan aallottomalla alueella, ja Euroopan
asemamerkit noudattavat kytkimiä (`_euSynkronoi`).

---

## 3. Mistä kate saadaan — jokaiselle valinnalle olemassa oleva lähde

| valinta | katteen lähde (ei uutta dataa) | kysymys |
|---|---|---|
| alueellinen malli (HARMONIE, MET Nordic, AROME …) | luettelon perheen tasot (`_perheenTaso`: `lat`/`lng`) ja laatan painokanava (`malliKohdassa`) | onko perheen paino > 0 jossain näkymän näytepisteessä |
| ECMWF, ICON, GFS | maailma | aina |
| Aallot-kerros | luettelon `aallot`-avaimen tasot (rajat), maski | leikkaako näkymä tason alueen ja onko siinä märkiä solmuja |
| Sade: tutka | `TutkaKate.nakyma(map)` ('kaikki' / 'osa' / 'ei') | valmiina |
| Sade: HARMONIE | `Sadeennuste._maski` | valmiina |
| Aaltopoijut | viimeisin poijuhaku (asemat vastauksesta, ei kovakoodattu) | onko näkymässä (+ 25 %) poijua |
| Rantalämpötilat / muut uimapaikat | UiRaS-asemat (`prim`-lippu) | onko näkymässä asemaa |
| Tuuliasemat · rannikko / sisämaa | `FMI_MAP_STATIONS` + `PAIKALLISASEMAT` + `esoh/asemat.json` (`meri`-kenttä) | kuinka monta asemaa näkymässä, kumpaa tagia |

E-SOH:n luettelo antaa myös **maan**: WIGOS-tunnuksen toinen kenttä on
ISO 3166 -numerokoodi (`0-250-…` = Ranska, `0-246-…` = Suomi). Siitä
alateksti voi nimetä verkon ("Météo-France, 41 asemaa näkymässä") ilman
uutta hakua. Numero → järjestö -taulukko on pieni ja kiinteä (EUMETNETin
jäsenet); järjestöjen nimiä ei käännetä.

**Näytteistys.** Kate kysytään näkymän 5 × 5 -hilasta + keskipisteestä
(`MalliHila`n peittotarkistus tekee jo saman, rivi 9744). Malli on
"näkymässä" kun sen paino on > 0 vähintään yhdessä pisteessä, ja
"pääosin" kun se on keskipisteessä. Kaukaa (koko Eurooppa näkyvissä) moni
malli on näkymässä yhtä aikaa — se on oikein: kaikki ne ovat silloin
mahdollisia.

**Ennen laattoja.** `malliKohdassa` palauttaa `null` kun laattoja ei ole
vielä muistissa. Silloin kate luetaan pelkistä tasorajoista
(`_perheenTaso`), joka on karkeampi (suorakaide, ei datan reuna) mutta ei
koskaan piilota mallia joka näkymässä on. Väärä suuntaan "näytetään
turhaan" on halvempi kuin "piilotetaan oikea".

---

## 4. Vaihtoehdot

### A — Tekstit paikallisiksi (pienin)

Rakenne pysyy. Alatekstit ja asteikkotekstit kirjoitetaan katteesta:
Paras saatavilla "täällä AROME HD · ECMWF", asemien esimerkit näkymän
asemista, HARMONIE-riville "ei kata näkymää — kartalla ECMWF".

- \+ Pieni ja turvallinen (ei dynaamisia rivejä, radiogroup ennallaan).
- − Kuolleet rivit jäävät: Ranskassa yhä kolme Suomen kytkintä ja kaksi
  Suomen mallia, ja AROME puuttuu edelleen. Pyyntö "ei turhia
  datapisteitä" jää täyttämättä.

### B — Himmennys: kaikki näkyvissä, katteettomat pois käytöstä

Jokainen rivi jää paikalleen; katteeton on himmeä (`aria-disabled`) ja
sanoo syyn ("Vain Suomessa").

- \+ Paneelin rakenne ja korkeus eivät koskaan muutu, ja käyttäjä oppii
  mitä muualla on.
- − Ranskassa viisi himmeää riviä seitsemästä havaintoriviä ja mallia:
  sama sotku hiljaisempana. Himmeä rivi on myös fokuspysäkki jolla ei voi
  tehdä mitään (saavutettavuussääntö "pysäkki jolla ei voi tehdä mitään
  on huonompi kuin ei pysäkkiä").
- − Ei ratkaise puuttuvaa AROMEa.

### C — Paneeli lukee saman katteen kuin kartta (SUOSITUS)

Katerekisteri + piilotus + "Muualla saatavilla" -rivi + luettelosta
rakennettu mallilista + paikalliset alatekstit. Yksityiskohdat luvussa 5.

- \+ Ranskassa paneelissa on vain se mikä Ranskassa toimii, ja Ranskan
  oma malli on listan toisena.
- \+ Ei mitään katoa pysyvästi: "Muualla saatavilla (3)" avautuu ja
  näyttää Suomen kytkimet tiloineen ("Vain Suomessa · päällä").
- \+ Sama rekisteri korjaa kortin mallivalikon (V5) ja antaa Tietoa-
  näkymälle paikallisen järjestyksen.
- − Dynaamiset rivit: roolit, vaeltava tabindex ja MutationObserver on
  ajettava uusille riveille (nyt ne asetetaan kerran latauksessa).
- − Paneelin korkeus vaihtuu paikan mukaan. Sivupaneelissa se on
  vieritettävä lista, joten hinta on pieni; ehto P-f estää hypyn käden
  alla.

### D — Alueprofiili (käyttäjä valitsee "Suomi / Eurooppa / Maailma")

Profiili päättää mitkä rivit näkyvät.

- \+ Yksinkertainen toteuttaa (kolme staattista listaa).
- − Kolme listaa on kolme kopiota katteesta (rikkoo P-a). Kartta tietää
  jo missä ollaan; erillinen valinta ajautuisi siitä erilleen
  (profiili "Suomi" ja kartta Ranskassa). Ei suositella.

### E — Havainnot pois asetuksista kartan kerrosvalikkoon

Havaintokytkimet siirrettäisiin kartan kontekstivalikoksi, joka näyttää
vain näkymän lähteet (Windyn tapa).

- \+ Kontekstisidonnaisuus tulee luonnostaan.
- − Iso uudelleensuunnittelu: uusi pinta, uusi kosketuskohde kartalle,
  kerroskytkimet kahdessa paikassa siirtymän ajan. Ei suositella nyt;
  C:n rekisteri tekee siitä myöhemmin helpon, jos sitä halutaan.

**Yhteenveto**

| | ratkaisee kuolleet rivit | paikan oma malli | työ | riski |
|---|---|---|---|---|
| A | ei (vain tekstit) | ei | pieni | pieni |
| B | himmentää | ei | pieni–keski | saavutettavuus |
| **C** | **piilottaa, säilyttää tilan** | **kyllä** | **keski** | **dynaamiset roolit** |
| D | karkeasti | osin | pieni | kopio katteesta |
| E | kyllä | ei suoraan | suuri | uusi pinta |

---

## 5. Suositus C tarkemmin

### 5.1 Katerekisteri `Kate`

Yksi moduuli, yksi kysymys: `Kate.nakyma()` → `{ avain, mallit:
[{ perhe, keskella, osuus }], aallot, tutka, harmonieSade, poijut,
uiras: { prim, sec }, asemat: { meri, maa, maat: { 250: 41, … } } }`.

- Lasketaan kun paneeli avataan ja sivupaneelin ollessa auki
  `moveend`issä (ei liikkeen aikana). Muisti näkymän rajoista (kuten
  `TutkaKate._avain`), joten saman näkymän toinen kysely on ilmainen.
- Ei omaa hakua: jos jokin luettelo on matkalla (E-SOH-luettelo, poijut),
  rivi on "tuntematon" ja näytetään kuten ennen. Tuntematon ei piilota.
- `?perf=1` vie `Kate`n `window.FS`:ään mittaria varten.

### 5.2 Havainnot kartalla

- Rivi näkyy kun sen lähteellä on näkymässä (+ 25 %, sama marginaali kuin
  Euroopan merkeillä) vähintään yksi asema.
- Muut rivit kootaan paneelin loppuun suljettuun riviin **"Muualla
  saatavilla (n)" / "Available elsewhere (n)"**. Avattuna rivit ovat
  tavallisia kytkimiä (tilan voi vaihtaa), ja alateksti sanoo missä
  ("Vain Suomessa", "Pääkaupunkiseutu"). Avattu/suljettu muistetaan
  istunnossa.
- Alatekstit näkymästä: rannikko- ja sisämaarivillä kaksi lähintä
  asemanimeä tai verkko ja määrä ("Météo-France · 41 asemaa"). Aseman
  nimi on ylävirran dataa: `escHtml`.
- Rivien järjestys on kiinteä (ei määrän mukaan), jotta sama rivi on
  samassa kohdassa aina kun se näkyy.

### 5.3 Kartan malli

- Lista rakennetaan: **Paras saatavilla**, sitten **näkymän alueelliset
  mallit luettelon etusijajärjestyksessä** (`perheet`), sitten **ECMWF,
  ICON, GFS**. Helsingissä lista on käytännössä nykyinen; Quiberonissa
  Paras · AROME HD · (UKV jos sen reuna on näkymässä) · ECMWF · ICON · GFS.
- **Alueellisen mallin pakotus on uusi tila**, mutta ei uusi datapolku:
  `TILAT` täydennetään luettelosta `{ perheet: [id], dyn: 'ecmwf' }`
  kuten `fmi` ja `metnordic` nyt (CLAUDE.md "MALLIVALINTA ON
  PERHEVALINTA"). Lähizoomin natiivihila tukee jo `?malli=<perhe>`.
  Nimet `Lahde.NIMET`istä, alateksti tason tiedoista (järjestö ·
  tarkkuus).
- **Paras saatavilla -alateksti** on näkymän mallit painon mukaan ("Täällä
  AROME HD · ECMWF"), ei kiinteä "FMI · MET Nordic · ECMWF".
- **Valittu malli jonka kate loppuu** (pakotettu AROME, kartta siirretään
  Saksaan): valinta pysyy listassa näkyvissä merkinnällä "ei kata
  näkymää — kartalla ECMWF", eikä sitä vaihdeta hiljaa Parhaaseen.
  Mallivalintaa ei tallenneta (`TALLENTAMATTOMAT`), joten seuraava avaus
  on joka tapauksessa Paras.
- Mallikuvaus (`MALLI_KUVAUS`) on nyt kuuden tilan kiinteä teksti.
  Alueelliset saavat kuvauksensa luettelon tiedoista (järjestö, tarkkuus,
  jakso tunteina), jotta uusi malli ei vaadi kahta uutta käännöstä.

### 5.4 Kerrokset

Neljä ruutua jäävät (Windyn malli, käyttäjän päätös 1.10.). Ruudun
katteella on kolme tilaa:

- **kattaa**: ennallaan;
- **osin**: ruutu ennallaan, asteikkoteksti kertoo missä ("Aallot:
  Itämeri");
- **ei kata**: ruutu on näkyvissä mutta sen nimen alla on "Ei tällä
  alueella", ja valinta on mahdollinen mutta kertoo tyhjän syyn kartalla
  (toast) sen sijaan että kartta olisi selittämättä tyhjä.

Sateen asteikkoteksti kirjoitetaan katteesta: Suomessa nykyinen teksti,
MEPS-alueella "HARMONIE, ei tutkaa", muualla "ECMWF 9 km, karkea".

Aallot Euroopassa on DATAkysymys eikä asetuskysymys (docs/eurooppa.md
S6: ECMWF WAM 0,25° hylättiin rannikolla). Tämä strategia ei lisää
aaltolähdettä; se vain lakkaa lupaamasta sitä siellä missä sitä ei ole.

### 5.5 Mitä EI tehdä

- Ei kytketä mitään pois alueen vuoksi (P-c).
- Ei tunnisteta laitteen sijaintia eikä selaimen kieltä alueeksi (P-b,
  kielisääntö).
- Ei piiloteta yksikköä, pohjakarttaa, lämpökarttaa eikä partikkeleita —
  niillä ei ole aluetta.
- Ei kirjoiteta katetta käsin yhteenkään taulukkoon.

---

## 6. Vaiheet

| vaihe | sisältö | koskee |
|---|---|---|
| **V1** | `Kate`-moduuli ja mittari (`tools/asetusmittaus.mjs`, luku 7) ilman näkyvää muutosta; nykytilan luvut taulukkoon | uusi moduuli, työkalu |
| **V2** | Havainnot: piilotus, "Muualla saatavilla", paikalliset alatekstit; roolien ja tabindexin alustus funktioksi joka ajetaan uudelleen | `#settings-popup`, `_applyMapLayers` ennallaan |
| **V3** | Mallilista luettelosta, alueellisen mallin pakotus (`TILAT`), Paras-alateksti, kuvaukset luettelosta | `Saalaatat.TILAT`, `KarttaAsetukset` |
| **V4** | Kerrosruutujen katetila ja asteikkotekstit katteesta | `_kerrosSirut`, `KerrosKuvat` |
| **V5** | Spottikortin mallivalikko samasta rekisteristä (spotin piste eikä näkymä); Tietoa-näkymässä näkymän lähteet ensin | `KorttiSarjat.MALLIT`, `Valikko` |

V2 tuo suurimman näkyvän hyödyn pienimmällä riskillä (kolme kuollutta
kytkintä pois Ranskassa), V3 suurimman sisällöllisen (AROME valittavaksi).
Jokainen vaihe on oma committinsa ja viedään oletushaaralle erikseen.

---

## 7. Hyväksymismittari

`tools/asetusmittaus.mjs` (ei CI:ssä, oikea data): tuotantobuild +
`vite preview`, puhelin (`hasTouch`) ja työpöytä, `timezoneId:
'Europe/Helsinki'`. Näkymät: Helsinki z9, Hanko z9, Tallinna z9, Oslo z9,
Quiberon z9, Provence z9, Garda z10, Sylt z9, Cornwall z9, Biskajan
avomeri z7, Kanariansaaret z9 (ei alueellista mallia), koko Eurooppa z4.

Jokaisessa näkymässä paneeli avataan ja luetaan näkyvät rivit, mallilista
ja ruutujen tilat, ja verrataan kartan omaan dataan:

1. **0 näkyvää havaintoriviä ilman merkkiä näkymässä** (merkit luetaan
   `_obsMarkersGlobal`ista ja Euroopan merkeistä/pisteistä).
2. **0 piilotettua riviä jonka lähteellä on merkki näkymässä.**
3. **Jokainen listan alueellinen malli on `malliKohdassa`n tuloksessa
   jossain näytepisteessä, ja jokainen tuloksen malli on listassa.**
4. **Tila säilyy**: Helsinki (kytke rantalämpötilat päälle) → Quiberon →
   Helsinki: `fs_tasot` tavulleen sama, kytkin päällä.
5. **Kieli**: `?kieli=en` ja DOMin tekstit suomen sanalistaa vasten
   jokaisessa näkymässä, myös "Muualla saatavilla" avattuna; desimaali-
   erotin.
6. **Sarkain**: radiogroup yhtenä pysäkkinä myös rakennetulla mallilistalla;
   fokus ei putoa bodyyn kun sivupaneelin rivit päivittyvät `moveend`issä.
7. **Kosketus**: rivien napautus oikealla kosketuksella (CLAUDE.md
   "Kosketuskohde on napautettava testissä").

Lisäksi savutesti (`tools/savutesti.mjs`) ennallaan ja yksi uusi rivi:
asetukset avautuvat Quiberonin näkymässä ilman `pageerror`ia.

---

## 8. Päätettävät kohdat

- **P1. Piilotus vai himmennys katteettomille riveille?**
  Suositus: piilotus + "Muualla saatavilla (n)" (C). Himmennys (B) jos
  halutaan että paneeli on joka paikassa saman korkuinen.
- **P2. Mihin kate verrataan: keskipiste vai koko näkymä?**
  Suositus: näkymä (+ 25 %) havainnoille ja malleille; keskipiste vain
  Paras-alatekstin järjestykseen. Keskipiste yksin piilottaisi Suomenlahden
  poijut kun keskellä on Viro.
- **P3. Alueelliset mallit pakotettaviksi kartalle?**
  Suositus: kyllä, vain näkymää kattavat (V3). Ilman tätä Ranskan
  käyttäjä ei voi verrata AROMEa ICONiin kartalla.
- **P4. Aallot-ruudun tila Euroopassa.**
  Suositus: "Ei tällä alueella" ruudussa (V4) nyt; Euroopan aaltolähde
  omana strategianaan (eurooppa S6).
- **P5. Päivittyykö avoin sivupaneeli kartan mukana?**
  Suositus: kyllä, `moveend`issä (iPad ja työpöytä pitävät paneelia auki
  kartan vieressä), fokuksessa olevaa riviä ei poisteta kesken.
- **P6. Kortin mallivalikko samaan rekisteriin?**
  Suositus: kyllä (V5); muuten paneeli ja kortti olisivat taas kaksi
  eri listaa samasta kysymyksestä.
