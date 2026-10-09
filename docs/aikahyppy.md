# Aikahyppy: kartta valmiina kun aikaa vaihdetaan (strategia 9.10.)

Käyttäjän raportti: kun aikajanalla menee historiaan tai tarpeeksi pitkälle
tulevaisuuteen, kartta latautuu hetken. Ehdotus: kun peruskartta on
ladattu nykyhetkelle, sovellus lataisi historian ja pitkän tulevaisuuden
karttalaatat, lämpölaatat ja partikkelit valmiiksi.

Tämä on strategia, ei toteutus. Luvut on mitattu 9.10. tuotannon
varastoa vasten (luettelo `luotu` 2026-10-09T17:28Z, tuotantobuild
`4245b3f`). Toteutus vaatii käyttäjän päätöksen (luku 7).

## 1. Tiivistelmä

- **Hidas tapaus on yksi ja tarkasti rajattu**: hyppy uuteen 24 tunnin
  aikapalaan **laajalla zoomilla** (Eurooppa, z ≤ 6), jossa näkymässä on
  monta alueellista tuntimallia. Puhelimella z5 +24 h: **5,7–6,4 s
  vanhaa tuntia ruudulla, sitten vajaa kenttä, ja valmis vasta 9,4–12,1 s**.
  Kaikki muut hypyt valmistuvat 0,1–1,8 sekunnissa, lähizoomin
  palvelinhilan tarkennus 1,4–3,4 sekunnissa.
- **Syy ei ole tavumäärä vaan rakenne.** Sama hyppy on yhtä hidas
  rajattomalla ja 4G-verkolla. `Saalaatat.varmista` hakee perheet
  PERÄKKÄIN, ja Euroopan näkymässä perheitä on 13: mitattuna 12
  kierrosta noin sekunnin välein (HARMONIE 0–1,3 s … ECMWF 11,1–13,4 s).
  Samaan aikaan lämpökartta kootaan 57 kertaa (2,3 s pääsäiettä), koska
  jokainen saapunut perhe laukaisee uuden kokoamisen.
- **Ehdotus "lataa kaikki valmiiksi" ratkaisisi oireen, mutta väärin.**
  Koko akselin varastolaatat yhdelle näkymälle maksavat 1,9 MB
  (puhelin z7,5), 4,5 MB (puhelin z5) ja 5,3 MB (työpöytä z7,5) ja
  vanhenevat jokaisella panoroinnilla. Se ei korjaisi peräkkäisiä
  kierroksia: esilataus itse kestäisi 33–49 s näkymää kohti. Lähizoomin
  palvelinhila (`MalliHila` z8+, `Natiivi` z10+) on tunti kerrallaan,
  joten "kaikki" olisi ~390 funktiokutsua näkymää kohti. Karttalaatat
  eivät riipu ajasta, eikä lämpökartalla tai partikkeleilla ole omaa
  ladattavaa: molemmat kootaan samoista säälaatoista.
- **Suositus**: ensin juurisyy (perheet rinnakkain, kokoaminen
  niputettuna, ei vanhaa tuntia ruudulla), sitten pieni ja kohdistettu
  ennakko (viereinen pala ja karkea turvaverkko koko akselille), ja vasta
  sitten verkon mukaan kasvava esilataus — käyttäjän idea Wi-Fi-tilana.
  Arvio: pahin hyppy 12 s → noin 1–2 s ilman lisätavuja (vaihe 1), ja
  alle 0,3 s uuden hetken karkeaan kenttään (vaihe 2, ~0,2–1,5 MB).

## 2. Mitä mitattiin

Asetelma: `vite preview` (tuotantobuild), Chromium + SwiftShader,
puhelin 390 × 844 `hasTouch` dpr 3 ja työpöytä 1440 × 900, Helsinki
(60,1 / 24,9), `timezoneId: Europe/Helsinki`, service worker estetty.
Varasto oikeasta `raw.githubusercontent`ista ilman levyvälimuistia.
4G-profiili: 100 ms kierros + 8 Mbit/s jaettu kaista (Playwrightin
reitityksessä, myös `/api`). Käynnistyksen jälkeen 15 s lepo, sitten
hypyt nyt-tunnista: −48, +24, +72, +120, +240 h, takaisin −48 ja nyt.

"Uusi hetki" = lämpökartan hila on kohdehetken (`LampoGL._hila.hetki`).
"Täysi" = sama ja näkyvältä alueelta ei puutu yhtään solmua eikä hila
odota. Partikkelit = `WindTexture.hila.hetki`. Mittarit:
`scratchpad/hyppy/hyppy.mjs` ja `akseli.mjs` (ei repossa).

### 2.1 Hypyn viive

| laite, zoom | −48 h | +24 h | +72 h | +120 h | +240 h | toisto |
|---|---|---|---|---|---|---|
| puhelin z5 | 0,57 s | **5,93 s vajaa, 9,44 s täysi** (95 laattaa, 1,45 MB) | 1,18 | 1,00 | 0,81 | 0,4 |
| puhelin z5, 4G | 0,56 | **5,94 vajaa, 11,44 täysi** | 1,45 | 1,46 | 1,80 | 0,2–0,4 |
| puhelin z7,5 | 1,36 | 1,74 (38 laattaa, 0,59 MB) | 0,70 | 0,90 | 0,67 | 0,2–0,4 |
| puhelin z7,5, 4G | 1,47 | 3,02 | 0,47 | 0,45 | 0,47 | 0,2–0,4 |
| puhelin z10 | 0,42 | 0,43 | 0,64 | 0,45 | 0,67 | 0,2–0,4 |
| puhelin z10, 4G | 0,62 | 0,55 | 0,46 | 0,46 | 0,45 | 0,4 |
| työpöytä z5 | 0,11 | **6,38 vajaa, 11,55 täysi** (104 laattaa, 1,73 MB) | 1,18 | 1,46 | 1,13 | 0,1 |
| työpöytä z7,5 | 2,67 | 4,60 (110 laattaa, 1,75 MB) | 0,78 | 0,67 | 0,70 | 0,1 |
| työpöytä z10 | 0,73 | 0,93 | 0,74 | 0,73 | 0,72 | 0,1–0,6 |

Lähizoomissa (z10) varaston kenttä on perillä alle sekunnissa, koska
keskipisteen laatat ovat jo muistissa kaikkine paloineen (aikajana ja
kortit hakevat ne, `varmistaPiste`). Mutta palvelimen hila (`/api/malli`:
ECMWF 9 km z8:sta, alueellinen natiivihila z10:stä) tulee jokaiselle
tunnille erikseen **1,4–3,4 s** hypyn jälkeen, eli kartta vaihtuu
kahdesti: varaston kenttä heti, tarkempi 2–3 s myöhemmin.

Kaukana tulevaisuudessa (+72 … +240 h) näkymässä on vain ECMWF, ja se on
halpa (1–41 laattaa). Historia (−48 h) on halpa, koska alueellisilla
malleilla ei ole menneisyyttä varastossa.

### 2.2 Miksi +24 h laajalla zoomilla on hidas

Puhelin z5, +24 h, kirjattu `Saalaatat._lataa`-kutsujen alku ja loppu
perheittäin (ms hypystä):

```
h 0–1312 · cz 1311–2284 · c1 2283–3198 · ah 3196–4107 · n 4098–5565
dn 5561–6603 · c2 6361–7583 · d2 7581–8734 · it 8732–9969
at 8734–11110 · ce 9971–12286 · l (ECMWF) 11133–13356
LampoGL._rakenna 57 kertaa, yhteensä 2 293 ms (pisin 211 ms)
WindTexture.build 13 kertaa, yhteensä 1 053 ms
```

Kolme asiaa yhdessä:

1. **Perheet peräkkäin** (`varmista`: "PERHE KERRALLAAN, TÄRKEIN
   ENSIN"). Sääntö tehtiin Suomea varten: FMI:n täyden laatan alle ei
   haeta MET Nordicia eikä ECMWF:ää, ja hinta oli "yksi kierros per perhe
   raja-alueella". Euroopan laajennuksen jälkeen näkymässä voi olla 13
   perhettä, eikä ylempi perhe peitä alempaa juuri missään laajalla
   zoomilla — kierroksia on 12 eikä mitään säästy.
2. **Uusi tunti osuu uuteen palaan.** Tuntimallien pala on 24 askelta eli
   24 tuntia, joten +24 h ylittää aina palan rajan. Kolmen tunnin
   ECMWF:n pala on 72 h ja kuuden tunnin 144 h, siksi kauempana on
   halvempaa.
3. **Jokainen perhe kokoaa hilan uudelleen.** Laatan saapuminen merkitsee
   vajaan hilan likaiseksi (`_kunUusia` → `_uusia`), ja kokoaminen tehdään
   enintään neljästi sekunnissa koko 12 s ajan. Pääsäie on varattu, ja se
   hidastaa myös purkua (`DecompressionStream`) ja seuraavaa kierrosta.

Kontin kierrosaika on noin 1 s, koska SwiftShader ja kokoaminen kilpailevat
samasta suorittimesta. Oikealla puhelimella kierros on lyhyempi, mutta
4G:n viive on pidempi, eli peräkkäisyyden kerroin pysyy.

### 2.3 Mitä ruudulla on odotuksen aikana

- **Lämpökartta pitää vanhan tunnin** enintään 6 s (`ODOTUS_MS`), koska
  uusi hila on vajaampi kuin vanha. Sitten vajaa uusi nousee ruudulle
  (puhelin z5: 2 097 solmua näkyvissä ilman dataa, työpöytä 3 173).
- **Partikkelit vaihtavat uuteen tuntiin heti** (0,12–0,2 s) vajaalla
  kentällä. Lämpökartta ja partikkelit näyttävät siis 1–6 s eri tuntia, eli
  ristiriitaisen kartan. Kapseli, kupla ja aikajanan palkit ovat oikeassa
  tunnissa heti, koska ne lukevat tähtäimen sarjaa, jossa on kaikki palat.
- Mikään ei kerro että kartta on matkalla. Käyttäjälle se näyttää siltä
  että valittu tunti ei vaikuttanut karttaan.

### 2.4 Koko akselin hinta (käyttäjän ehdotus)

Hypyt 12 h:n välein koko akselin läpi (394 tuntia, 33 hyppyä), eli
näkymän kaikki palat jokaiselle perheelle:

| näkymä | käynnistys + 15 s | koko akseli lisää | kesto | laattoja muistissa |
|---|---|---|---|---|
| puhelin z7,5 | 4,0 MB | **+1,9 MB** (120 pyyntöä) | 33 s | 75 |
| puhelin z5 | 4,7 MB | **+4,5 MB** (265 pyyntöä) | 49 s | 149 |
| työpöytä z7,5 | 7,6 MB | **+5,3 MB** (328 pyyntöä) | 45 s | 191 |

Karkein taso koko Euroopasta ja koko akselilta (HEAD-koot luettelosta):

| taso | tiedostoja | koko |
|---|---|---|
| alueelliset 1,0° (`<id>4`, 12 perhettä) | 133 | **1,01 MB** |
| ECMWF 1,0° (l2, 30–75 N, −30–45 E) | 60 | **1,53 MB** |
| alueelliset 0,5° (`<id>3`) | 316 | 3,40 MB |
| ECMWF 0,5° (l1) | 160 | 3,77 MB |

Koko Euroopan karkea turvaverkko on siis **2,5 MB koko akselille**, ja
yhden näkymän ympäristö siitä murto-osa.

## 3. Käyttäjän ehdotus arvioituna

**Oikein:** ennakkolataus on alan tapa (karttasovellukset esihakevat
ympäröivät laatat ja sääkartat viereiset hetket), ja kun data on
muistissa, hyppy on mitattuna 0,1–0,4 s (rivi "toisto" yllä).

**Väärin "kaikki heti" -muodossa:**

1. **Se ei korjaa syytä.** Esilatauskin kulkee saman `varmista`n kautta,
   eli 12 peräkkäistä kierrosta per pala. Koko akseli kesti näkymää kohti
   33–49 s, ja jos käyttäjä hyppää ennen sitä, odotus on sama kuin nyt.
2. **Se vanhenee jokaisella panoroinnilla ja zoomilla.** Laatat ovat
   näkymän laattoja. Uusi näkymä = uudet 2–5 MB. Lisäksi ennakko kilpailee
   kaistasta sen näkymän kanssa jota käyttäjä juuri katsoo.
3. **Mobiilidata.** 2–5 MB näkymää kohti on kymmenen panoroinnin
   istunnossa 20–50 MB, ja suurin osa jää käyttämättä. Rannalla 4G:llä
   se on juuri se data joka hidastaa nykyhetken näkymää.
4. **Muisti.** Laattamuisti on 320 laattaa (~40 MB). Koko akseli vie
   yhdeltä näkymältä 75–191 laattaa, joten kaksi näkymää täyttää sen ja
   alkaa pudottaa nykyhetken laattoja (`_MAX_LAATTAA`).
5. **Palvelinhila ei kestä sitä.** Lähizoomin tarkka kenttä on
   tunti kerrallaan `/api/malli`-kutsuja. Koko akseli olisi ~390 kutsua
   näkymää kohti: Vercelin kiintiö ja Open-Meteon S3 maksavat sen, ja
   palvelimen vastaus on 1,4–3,4 s kutsua kohti.
6. **Karttalaatat ja partikkelit eivät tarvitse sitä.** Pohjakartta ei
   muutu ajassa (ja on jo välimuistissa), lämpökartta ja partikkelit
   kootaan samoista säälaatoista hetkellä jolla niitä tarvitaan (35–40 ms
   puhelimella). Esikoottuja hiloja ei kannata pitää: niitä olisi 394 ×
   kaksi hilaa × näkymä.

Ehdotuksen ydin — data valmiina ennen kuin sitä pyydetään — on oikea.
Se kannattaa tehdä **kohdistettuna** (mitä käyttäjä todennäköisimmin
katsoo seuraavaksi), **halvimmasta tarkkuudesta alkaen**, ja **verkon
mukaan**: täysi koko akselin esilataus on järkevä tila Wi-Fi:llä.

## 4. Vaihtoehdot

Arvioitu jokaisen vaikutus pahimpaan hyppyyn (puhelin z5 +24 h, nyt
5,9 s vanhaa + 12 s täyteen), tavuihin ja riskiin.

### S1. Perheet rinnakkain ja kokoaminen kierroksen lopussa (juurisyy)

`varmista` hakee kaikkien perheiden puuttuvat palat yhdellä kierroksella.
Peittosääntö säilyy vain kun ylemmän perheen laatta on JO muistissa ja
täysi (Suomen sisämaa), muuten ei odoteta. Hila kootaan kun kierros on
valmis tai 300 ms:n välein, ei jokaisesta perheestä.

- Arvio: 12 kierrosta → 1–2. Pahin hyppy noin 1,5–2,5 s täyteen (yksi
  kierros + purku + kokoaminen), 4G:llä vähän enemmän. Kokoamisia 57 → 3–5.
- Tavut: Suomen sisämaassa voi tulla muutama ECMWF-laatta FMI:n alle
  (mitattava; arvio < 5 %).
- Riski: pieni. Samanaikaisia pyyntöjä enemmän (95 kerralla) — selain
  jonottaa HTTP/2:ssa, ja hyvä raja on noin 16 kerrallaan tärkein ensin.
- Puhelin ja työpöytä hyötyvät samoin. **Tämä on ainoa vaihtoehto joka
  korjaa itse syyn, ja se nopeuttaa myös panorointia ja käynnistystä**,
  koska ne kulkevat saman `varmista`n kautta.

### S2. Kartta ei koskaan näytä väärää tuntia

- Lämpökartta ja partikkelit vaihtavat tuntia samassa ruudussa: joko
  partikkelit odottavat samaa `_odottava`a, tai molemmat vaihtavat heti.
- Hyppy näyttää **heti uuden tunnin karkeimman saatavilla olevan kentän**
  (karkea hila L(tz − 1) tai turvaverkon 1,0°, ks. S4) eikä vanhaa tuntia.
  Tarkka tulee perään nykyisellä häivytyksellä (0,3 s). Väärän tunnin
  kenttä on pahempi kuin karkea oikea, kuten tyhjän hetken sääntö jo
  sanoo.
- Latauksen merkki: aikajanan kuplaan tai osoittimeen hienovarainen
  merkki (esim. ohut pyörivä kaari kuplan reunassa) vain jos kenttä on
  vajaa yli 300 ms. Ei latausruutua, ei harmaata karttaa.
- Riski: pieni. Ei tavuja. Vaatii päätöksen: kumpi on parempi, sumea
  oikea vai terävä väärä (suositus: sumea oikea).

### S3. Viereinen pala taustalla (kohdistettu ennakko)

Kun kartta on levossa ja verkko hiljaa (`requestIdleCallback` + 1 s),
haetaan näkymän nykyisten tasojen **seuraava pala** (ja sitten
edellinen), matala prioriteetti (`fetch(..., { priority: 'low' })`),
enintään 4 kerrallaan, ja peruutetaan kun näkymä vaihtuu.

- Kattaa todennäköisimmän liikkeen: seuraava päivä ja toisto. Toisto
  hakee jo nyt seuraavan palan kynnyksellä (`varmista`, `liike`).
- Tavut: yksi palanvaihto = 0,6 MB (puhelin z7,5) … 1,5 MB (puhelin z5).
- Hyppy +24 h: 0,1–0,4 s (muistista). +48 h ja kauemmas ei hyödy.

### S4. Karkea turvaverkko koko akselille

Jokaisen näkymässä olevan perheen **karkein taso (1,0°)** koko akselille
näkymän ympäristöön taustalla heti käynnistyksen jälkeen (tai S3:n
jälkeen). Koko Eurooppa on 2,5 MB, Suomen näkymä noin 0,2–0,5 MB
(mitattava).

- Mikään hyppy ei näytä vanhaa tuntia eikä tyhjää: uuden hetken karkea
  kenttä on aina muistissa, ja S2 näyttää sen heti.
- Mobiiliystävällinen, koska yksi 1,0°:n laatta kattaa 20° × 20° —
  panorointi ei vanhenna sitä kuten tarkat laatat.
- Lähizoomissa karkea 1,0° on hetken selvästi sumea (sekunnin murto-osa,
  koska keskipisteen tarkat laatat ovat jo muistissa kaikkine paloineen).
- Rakentaja voisi kirjoittaa karkeimman tason kokonaisina laattoina
  (ilman paloja: yksi tiedosto koko akselille), jolloin pyyntöjä on
  palojen määrän verran vähemmän (133 + 60 → 34 + 12). Valinnainen.

### S5. Ennakko eleen aikomuksesta

Hyppy on harvoin yllätys: sormi koskettaa päiväkiskoa, hiiri on
päivälapun päällä, kelihyppy-nappia painetaan. Kohdepala haetaan jo
`pointerdown`ista tai leijunnasta, ja kiskon vedon aikana sen palan joka
osoittimen alla on (karkea taso).

- Antaa 100–300 ms etumatkaa napautukseen ja koko vedon ajan vetoon.
- Pieni muutos, tavut vain siitä mitä käyttäjä oikeasti katsoo.

### S6. Verkon mukaan kasvava esilataus (käyttäjän idea tilana)

Budjetti `navigator.connection`ista (Android/Chromium) ja
oletuksena muualla (iOS ei kerro verkkoa):

| tila | ennakko |
|---|---|
| `saveData` | ei ennakkoa (vain S1 ja S2) |
| mobiili tai tuntematon (iOS) | S3 + S4 + S5, enintään ~3 MB istunnossa |
| Wi-Fi tai `effectiveType` 4g + `downlink` > 10 | myös koko akseli näkymän tarkalla tasolla (2–5 MB / näkymä), vasta kun näkymä on ollut paikallaan 3 s |

- Asetuksiin EI uutta kytkintä ilman käyttäjän pyyntöä; jos halutaan,
  "Lataa ennuste valmiiksi: Automaattinen / Aina / Ei koskaan".
- iOS on suurin käyttäjäryhmä eikä kerro verkkoa, joten oletus on
  mobiilin budjetti.

### S7. Lähizoomin palvelinhila (z8+, z10+)

`MalliHila` (ECMWF 9 km) ja `Natiivi` haetaan tunti kerrallaan, ja hypyn
jälkeen kartta tarkentuu 1,4–3,4 s myöhemmin. Vaihtoehdot:

- a) ECMWF 9 km tuntipakettina (±3 h) kuten ICON ja GFS jo ovat
  (`pakettiPuoli`): viereiset tunnit tulevat samassa kutsussa. Kalliimpi
  kutsu, mutta toisto ja askellus ovat ilmaisia.
- b) Levossa viereiset tunnit taustalla (±1 h), ei kauemmas.
- c) Ei muutosta: varaston kenttä on oikea tunti heti, tarkennus
  häivytetään. Tämä on nykyinen sopimus ja hyväksyttävä.

Suositus b), koska se ei muuta palvelinta. Ei koko akselia (~390 kutsua).

### S8. Infra

- **GitHub Pages päälle** (repon asetukset, käyttäjän toimenpide):
  Fastly-CDN lähellä käyttäjää, ja sovellus kokeilee sitä jo ensin
  (`SAALAATAT_KANNAT`, toimiva koti muistetaan `fs_saakanta`an), mutta
  Pages on yhä pois päältä ja kaikki tulee raw'sta (`max-age=300`).
  Mittaamatta, arvio 20–50 % lyhyempi kierros.
- Service workerin säälaattavälimuisti pitää jo laatat versiolla (`?v=`)
  istuntojen välillä, joten saman päivän toinen käynti on nopea.
  `navigator.storage.persist()` estäisi selainta siivoamasta sitä
  (iOS siivoaa herkästi). Pieni muutos.

### Mitä EI ehdoteta

- **Esikoottuja hiloja tai kuvia joka tunnille.** Kokoaminen on 35–40 ms
  puhelimella; muisti olisi satoja megatavuja.
- **Pienempiä paloja (esim. 12 h).** Puolittaisi palanvaihdon tavut mutta
  tuplaisi pyynnöt ja rajojen määrän; S1 + S3 ratkaisevat saman.
- **Isompaa laattamuistia ennen mittausta.** 320 laattaa riittää S3:lle
  ja S4:lle; vain S6:n Wi-Fi-tila voi vaatia sitä.
- **Koko akselin esilatausta mobiilissa oletuksena** (luku 3).

## 5. Suositus ja vaiheet

| vaihe | sisältö | tavut | odotettu vaikutus |
|---|---|---|---|
| **V1** | S1 perheet rinnakkain + kokoaminen niputettuna | ±0 | pahin hyppy 12 s → ~2 s; myös panorointi ja käynnistys nopeutuvat |
| **V2** | S2 ei väärää tuntia + latausmerkki | 0 | kartta ja partikkelit samassa tunnissa aina; ei "mitään ei tapahtunut" |
| **V3** | S4 karkea turvaverkko + S3 viereinen pala | +0,2–1,5 MB | jokainen hyppy näyttää oikean tunnin < 0,3 s, +24 h täysi < 0,5 s |
| **V4** | S5 aikomuksen ennakko + S7 b) palvelinhilan viereiset tunnit | pieni | napautus ja veto tuntuvat välittömiltä myös lähizoomissa |
| **V5** | S6 verkkotietoinen täysi esilataus (Wi-Fi) | 2–5 MB / näkymä Wi-Fi:llä | koko akseli välitön työpöydällä ja kotona |
| — | S8 Pages päälle (käyttäjä), `storage.persist` | 0 | lyhyempi kierros kaikkeen |

V1 ja V2 ovat korjauksia eivätkä ominaisuuksia: ne tekevät hypystä oikean
ilman lisädataa. V3 on se joka tekee siitä välittömän. V5 on käyttäjän
alkuperäinen idea oikeassa paikassa.

## 6. Hyväksymismittarit

Mitataan samalla asetelmalla (luku 2), puhelin ja työpöytä, z5 / z7,5 /
z10, rajaton ja 4G, hypyt −48 … +240 h, mediaani viidestä ajosta ja
raakaluvut näkyvissä:

1. **Uuden tunnin kenttä ruudulla** (`_hila.hetki` = kohde, karkeakin
   kelpaa): ≤ 0,3 s 95 %:ssa hypyistä V3:n jälkeen; V1:n jälkeen ≤ 2,5 s.
2. **Täysi kenttä**: viereinen pala ≤ 0,5 s; mikä tahansa hyppy 4G:llä
   ≤ 3 s.
3. **Lämpökartta ja partikkelit samassa tunnissa** joka mittauspisteessä
   (40 ms välein): 100 %.
4. **Ei regressiota**: ensimmäinen näkymä ja panorointi tavuina ±10 %
   nykyisestä (`ensinakyma.mjs`), tunnin askel puhelimella ≤ 45 ms
   (`tuntiaskel.mjs`), savu- ja graafitesti vihreät.
5. **Tavubudjetti**: mobiiliprofiilin ennakko ≤ 3 MB istunnossa
   (10 panorointia), Wi-Fi-tilan ennakko vain näkymälle joka on ollut
   paikallaan 3 s.
6. **Lähizoomin tarkennus** (z10, palvelinhila): viereinen tunti ≤ 0,5 s
   V4:n jälkeen.
7. Oikealla laitteella (iPhone, 4G) käyttäjän tuntuma: hyppy
   seuraavaan päivään ja viikon päähän z5:llä ja z9:llä.

## 7. Päätettävät kohdat

- **P1. Sumea oikea vai terävä väärä?** Suositus: hypyssä näytetään
  heti uuden tunnin karkea kenttä eikä vanhaa tuntia (S2).
- **P2. Latausmerkki**: kuplaan vai ei lainkaan? Suositus: vain kun
  kenttä on vajaa yli 300 ms, hienovarainen.
- **P3. Mobiilin budjetti**: ~3 MB istunnossa (S3 + S4 + S5) — riittääkö,
  vai halutaanko enemmän?
- **P4. Wi-Fi-tila (S6)**: automaattinen vai asetus? Suositus:
  automaattinen, ei uutta asetusta.
- **P5. Pages päälle** repon asetuksista (käyttäjän toimenpide).
