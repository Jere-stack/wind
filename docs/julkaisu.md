# Julkaisukelpoisuus — UI:n top 25, suositusjärjestys ja logiikan top 10

27.9.2026. Tämä on päätöspohja, ei toteutus. Käyttäjä valitsee mitä
tehdään, tai mennään suositusjärjestyksessä (osa 2).

**Miten tämä tehtiin.** `npm run build` + `vite preview`, Chromium
puhelimena (390×844, `hasTouch`, `isMobile`, Europe/Helsinki) ja
työpöytänä (1440×900). Kuvakaappaukset latausruudusta, kartasta,
spottikortista (Lauttasaari, Haukilahti), asetuksista, ennustepaneelista
ja offline-tilasta; DOM-tila ja rajapintakutsut luettiin selaimesta. Koodi
luettiin kohdista joihin havainnot osuivat. Rivinumerot ovat
`index.html`:n rivejä tässä versiossa (88b131e).

**Mitä ei voitu tarkistaa.** Tuotanto-osoite (`wind-delta.vercel.app`)
ja `api.open-meteo.com` eivät vastanneet kontista, ja välityspalvelin
katkoi osan pohjakartan ja säälaattojen pyynnöistä — lämpökartan ja
pohjakartan ulkoasua ei siksi arvioitu. Ei WebKitiä, ei oikeaa laitetta,
ei ruutunopeuksia (CLAUDE.md: kontti ei mittaa niitä).

**Mitä tässä EI ehdoteta**, koska ne ovat käyttäjän lukittuja päätöksiä:
vaalea pohjakartta, värisokeusramppi, väriasteikko kartalle, aikajanan
kortti tai ura, valokaista, puuskahuntu, nauha, jaksovalitsimet,
kelluva työkaluvihje, teksti latausruudulle, latausruudun keston muutos,
partikkelien jäädytys, pillerien lasin poisto. Aikajana on lukittu
(docs/spottikortti.md, "Ei aikajanan muutoksia"); kohta 23 koskee sitä
ja on siksi merkitty.

Työmäärä: **S** ≤ ½ päivää, **M** 1–2 päivää, **L** 3+ päivää.
Prioriteetti: **P0** julkaisun este, **P1** vahva suositus, **P2**
viimeistely.

---

## Osa 1 — Design ja UI, top 25

### P0

**1. Virhe- ja tyhjätilat (S–M).**
Latausruutu jää pysyvästi "Ladataan..."-tilaan jos käynnistys kaatuu
(mitattu: MapLibre ei latautunut → 33 s+ ilman viestiä; syy logiikan
kohdassa L1). Kortin "Ladataan ennustetta…" ei aikakatkaise.
Ennustepaneelin tyhjätila sanoo "Valitse aikasuodatin ylhäältä" myös
silloin kun syy on ettei näkymässä ole spotteja (23290). `#rl-banner` on
vanhaa asua: ✕ on `div onclick` eikä `.paneeli-sulje` (4600–4603).
→ Latausruudulle virhenäkymä (syy + Yritä uudelleen), kaaviolle
aikakatkaisu ja uusintanappi, oikea tyhjätila paneeliin, rl-banner
Verkkotila-siruksi.

**2. Tietoa-näkymä: lähteet, tietosuoja, palaute, versio (S–M).**
Lähdemaininta on asetusten pohjalla (4444–4459) ja vajaa (ks. L6).
Sovellus käyttää sijaintia ja localStoragea, mutta tietosuojasta ei
sanota mitään; palautekanavaa ei ole. → Oma paneeli samalla
`.paneeli-yla`lla ja `Modaali`-kytkennällä (muista Esc-lista).
Pari L6:n kanssa.

**3. Ensikäynnistys: aloitusnäkymä ja kertaopastus (M).**
Kartta aukeaa koko Suomeen (`center [25.5, 62.5]`, z5, 9023), jolloin 12
spottia ovat yksi kasa etelärannikolla (työpöydällä renkaat 17/56/33
päällekkäin). Tähtäin, kapseli, värit, indeksi ja karttamerkkien lajit
(spotti, asema, poiju, vesi) jäävät selittämättä, ja väriasteikko on vain
asetuksissa (lukittu päätös). → Ensimmäisellä käynnillä etelärannikko
(Porkkala–Emäsalo) tai sijainti; latausruudun JÄLKEEN kolmen kortin
kertaopastus, jossa väriasteikko näytetään kerran. Ei tekstiä
latausruudulle.

**4. Yksi luku yhdelle suureelle samalla ruudulla (S–M).**
Kortti auki: kapseli näyttää kartan keskustan 2,6 kts ja hero 6,9 kts.
Samassa kortissa vedenlämpö 12,9 °C (laatta) ja 13,3 °C (kaavio).
Vedenkorkeuslaatassa "+23 cm" ja "nyt +25 cm". → Kapseli piiloon tai
spotin lukemaksi kun kortti on auki; laatta ja kaavio samasta lähteestä;
toinen luku nimetään (ennuste/havainto, aika).

**5. Numerot ja päiväykset suomeksi (M).**
`Units.fmt` on `toFixed` (5349): "6.9 kts", "12.9 °C", "×1.4" — mutta
asetusten teksti sanoo "2,5 km". Päiväys kolmessa muodossa: "Su 27.9. klo
19", "Su 27.", "SU 27. SYY" (23259). Luku ja yksikkö rivittyvät erilleen
("Suomenlinna 7 / km · 85 min sitten"). → Yksi `luku()`
(`Intl.NumberFormat('fi-FI')`) ja yksi päiväysapuri; sitova välilyönti
luvun ja yksikön väliin. Kaavioiden SVG-luvut mukaan.

**6. Parhaat ajankohdat -paneelin UI (S).**
Kolme kytkintä, joista "Kaikki päiväajat" ohittaa muut (23197) — se on
yksivalinta. Spotin nimi on indeksin värinen (23310), vastoin sääntöä
"nimilappu on mustetta". Alaotsikko lupaa 2 h ikkunat, laskenta on kolme
tuntipistettä. → `.segmentti` (Arki-illat / Viikonloppu / Kaikki),
nimet musteella, sama päiväysmuoto. Data korjataan kohdassa L5.

**7. Karttanapit tunnistettaviksi (S).**
Neljä 44 px ikoninappia: sijainti, nuppineula ("Avaa tämän paikan
tiedot"), kalenteri ("Parhaat ajankohdat") ja säätimet. Kahta keskimmäistä
ei arvaa kuvasta, ja nimi on vain `title`/`aria-label`issa. →
Kuvaavampi symboli kärkilistalle, nimilappu napin viereen ensimmäisillä
käyttökerroilla, työpöydällä nimi hoverissa.

**8. Spottiindeksin selitys (S, L4:n jälkeen).**
Rengas "22 spottiindeksi" ilman selitettä; alhaalla "22 / 100 · 8/60
nopeus · 13/30 suunta" — osat eivät summaudu näkyvästi ja katto on
oikeasti 90 (L4). → Renkaan napautus avaa lyhyen selitteen: mistä luku
tulee ja mikä on hyvä. Asteikko korjataan ensin.

**9. Kehittäjäkieli pois käyttäjän tekstistä (S).**
"Kerätään vertailua ennusteen ja havainnon välillä (1/5)" (8250);
"Paras saatavilla: FMI HARMONIE → MET Nordic → ECMWF 9 km, sama
sekoitus kuin kartalla"; asetusten mallivihje viisi riviä (66 tuntia,
zoomista 8, 0,25°); "Malleissa eroa 3.0 kts — tarkista lähempänä"
(17658). → Tekstikierros; tekninen kuvaus Tietoa-näkymään.

**10. Datan tuoreus näkyviin (S).**
Kartalla ei kerrota milloin ennuste on ajettu tai päivitetty
(`#refresh-dot`-pulssi on ainoa merkki). Havainnoilla ikä on, ennusteella
ei. → Lähdemerkintään ja korttiin ajoaika ("ajo klo 15"); vanha data
Verkkotilan kautta kuten nyt.

### P1

**11. Spottikortin ensimmäinen ruutu (M).**
Puhelimella kortti on noin viisi ruudullista. Kaavion alla on kuusi
mallisirua kahdella rivillä ja Päällekkäin/Allekkain ennen yhtäkään
havaintoa. → Mallivertailu yhdeksi avautuvaksi kontrolliksi, jotta hero
ja seuraavat tunnit mahtuvat ensimmäiseen ruutuun. V9:n moduulijärjestys
säilyy.

**12. Kaksi mallivalitsinta, kaksi merkitystä (S).**
Asetusten "Kartan säämalli" ja kortin kaaviosirut käyttävät samoja
nimiä eri vaikutuksella, ja nimet eroavat ("FMI HARMONIE" / "HARMONIE",
"Yr (MET Nordic)" / "MET Nordic"). → Otsikot "Kartan malli" ja "Vertaa
kaaviossa", nimet `Lahde`-rekisteristä.

**13. Värikuri paneeleissa (S).**
Nimet vihreinä ennustepaneelissa, "×1.7 hyvin puuskainen" punaisella ja
"×1.4 puuskainen" ruskealla, asemavalitsin magentalla tekstillä ja
vaaleanpunaisella pohjalla, "NYT" magentana. Sääntö: `--accent` on vain
toiminto ja varoitus, nimet ovat mustetta. → Auditointi ja korjaus.

**14. Tyhjä "Ilma · havainto — °C" Lauttasaaressa (S).**
Laatta on `display: flex` eikä `hidden`, vaikka Larulla ei ole
lämpömittaria ja CLAUDE.md vaatii piilotuksen (sääntö on 18710:ssä,
mutta `lampomittari` ei ilmeisesti päädy sinne tätä polkua). → Selvitä
polku ja korjaa.

**15. Saavutettavuuden aukot (S).**
Kuusi `.mctl`-kontrollia on yhä `<div role="button">` (4477–4536), vaikka
CLAUDE.md sanoo `<button>`. Yksikkö- ja suuntavalitsimen `.up-option`-
rivit ovat ilman roolia ja tabindexiä. `#rl-banner-close` on div. →
Napeiksi; valitsimet radiogroupiksi kuten asetuksissa.

**16. Jakolinkin esikatselu (S).**
`og:`- ja `twitter:`-tageja on 0, joten jakonappi lähettää paljaan
osoitteen ilman korttia. → `og:title`, `og:description`, `og:image`
(merkistä), `og:locale fi_FI`.

**17. Kotivalikkoon asentaminen (S).**
iOS ei näytä asennuskehotetta, ja sovellus on rakennettu kotivalikkoon
(standalone-luokka, turva-alueet). → Kertaluonteinen, suljettava vihje
toisella käynnillä; ei latausruudulle.

**18. Suuntanuolet piirretyiksi (S).**
`dirArrow` palauttaa Unicode-nuolia 45° portain (13778), kapselissa on
piirretty SVG-nuoli — kaksi eri nuolta samaan asiaan, ja Unicode-nuoli
piirtyy alustan fontilla. Tähti ja jako korvattiin piirretyillä samasta
syystä. → Pieni SVG-nuoli, joka kiertyy tarkkaan asteeseen.

**19. Englanti suomenkielisessä sovelluksessa (S–M).**
Latausruudun "Wingfoil Weather"; pohjakartan nimet englanniksi (SWEDEN,
Gulf of Finland, ESTONIA). → Tagline suomeksi tai tietoinen
brändipäätös; selvitä suomenkieliset nimet tai nimetön pohja.

### P2

**20. "Spotit nyt" -lista (M).**
Spotin löytää vain kartalta. Suosikit vaikuttavat vain aloitusnäkymään ja
merkkien etusijaan (24170, 13832), eikä niitä näe listana. →
Ennustepaneelin yläosaan nyt-lista kaikista spoteista indeksin mukaan,
suosikit ensin.

**21. Spottien kattavuus ja oma paikka (M).**
12 kovakoodattua spottia Hangosta Emäsaloon (5727), vaikka manifesti
lupaa "Suomen rannikon spotit". Nuppineula avaa vapaan pisteen kortin,
mutta sitä ei voi tallentaa. → Lisää spotteja (`tools/suunnat.html`);
"Tallenna paikka" vapaasta pisteestä.

**22. Asetusten ryhmittely (S).**
Yksi pitkä lista; seitsemän karttatasoa (FMI Meri/Maa, poijut, sade,
rantalämpötilat, muut uimapaikat) samassa ryhmässä. → "Kartta" /
"Havainnot kartalla" / "Tietoa"; väriasteikko yksikön viereen.

**23. Työpöydän asettelu (M) — koskee lukittua aikajanaa.**
1440 px:llä palkit alkavat ruudun puolivälistä ja play-nappi on 600 px
päässä vasemmassa reunassa. Vain käyttäjän päätöksellä.

**24. Heron viestit yhdeksi päätökseksi (M, L4:n jälkeen).**
Herossa on viisi signaalia: foil-merkki, puuskarivi värillisenä, suunta,
indeksirengas ja "Malleissa eroa…". → Yksi päätösrivi yhtenäisistä
kynnyksistä, muut tueksi.

**25. Reittiohje yhdeksi napiksi (S).**
Kortin lopussa Google Maps ja Waze; iPhonella ei Apple Mapsia. → Yksi
"Reittiohje", joka avaa laitteen oletuskartan; Waze valikkoon.

---

## Osa 2 — Suositusjärjestys

Periaate: ensin se mikä voi rikkoa sovelluksen kaikilta kerralla, sitten
se mikä estää julkaisun juridisesti tai kapasiteetiltaan, sitten
ensivaikutelma, lopuksi viimeistely. Riippuvuudet on merkitty.

**Vaihe 0 — pienet korjaukset, suuri vaikutus (noin 1–2 päivää)**
1. L1 ikuinen latausruutu + UI 1 virhenäkymä
2. L5 menneet ikkunat pois ja oikea data + UI 6 paneelin ulkoasu
3. L7 päivitys taustalta palatessa
4. UI 14 tyhjä lämpötilalaatta, UI 15 saavutettavuus, UI 16 OG-tagit

**Vaihe 1 — julkaisun esteet (noin 1 viikko)**
5. L9 savutesti CI:hin *ensin*, jotta muut muutokset voi todentaa
6. L3 säälaattojen isännöinti ja rajapintakiintiöt
7. L10 rajapintojen suojaus
8. L2 MapLibre omasta originista
9. L8 buildin minifiointi
10. L6 lisenssit + UI 2 Tietoa-näkymä

**Vaihe 2 — ensivaikutelma (noin 1 viikko)**
11. L4 yhtenäiset kynnykset ja indeksin asteikko → sen päälle UI 8 ja UI 24
12. UI 3 ensikäynnistys, UI 7 karttanapit
13. UI 4 yksi luku, UI 5 numerot ja päiväykset, UI 9 tekstit, UI 10 tuoreus

**Vaihe 3 — viimeistely**
14. UI 11–13, 17–19, 22, 25
15. UI 20–21 (spottilista ja kattavuus)
16. UI 23 vain jos aikajanan lukitus avataan

---

## Osa 3 — Logiikka, top 10 kriittisintä

**L1. Käynnistys voi jäädä ikuiseen latausruutuun (S).**
Varmistusajastin puretaan juuri ennen `main()`ia:
`clearTimeout(_loadingSafety); main();` (24551 ja 24554). Kaikki mikä
kaatuu `main()`issa jättää siis "Ladataan..."-ruudun päälle, eikä
napautus ohita sitä (`_lahtoTarkista` vaatii `_loadDone`n). Mitattu:
MapLibre-skripti ei latautunut → `maplibregl is not defined` → ruutu
näkyi yhä 33 s kohdalla. Sama käy jos WebGL-konteksti ei synny
(`new maplibregl.Map`). Kommentti sanoo 5 s, koodi 12 s. →
`main().catch(virhenakyma)`, ajastin puretaan vasta onnistuneen
käynnistyksen jälkeen, globaalit `error`/`unhandledrejection`-käsittelijät.

**L2. MapLibre on synkroninen CDN-skripti ilman eheystarkistusta (S–M).**
`<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/…">`
`<head>`issä ilman `integrity`ä. Se estää jäsennyksen, joten latausruutu
ei piirry ennen kuin kirjasto on ladattu, ja jsDelivrin katko tai
suodatus (koulu- ja yritysverkot) tappaa sovelluksen ensikäynnillä —
service worker välimuistittaa sen vasta onnistuneen käynnin jälkeen. →
`npm i maplibre-gl` ja Viten kautta samasta originista, tai vähintään
`integrity` + `defer`, ja L1:n virhenäkymä.

**L3. Säälaatat raw.githubusercontentista, ja varatie kuluttaa yhteisen
kiintiön (M–L).**
Laatat haetaan `raw.githubusercontent.com`ista, jolla ei ole palvelutasoa
ja jota GitHub rajoittaa. Kun laattahaku epäonnistuu, jokainen asiakas
putoaa rajapintapolulle: kontissa (jossa osa laattapyynnöistä katkesi)
aloitusnäkymä teki **40 `/api/harmonie`-pyyntöä × 15 pistettä ≈ 600
pistettä**. Jokainen piste on palvelimella yksi FMI WFS -kutsu ja yksi
Open-Meteo-kutsu (`haePiste`), ja kaikki käyttäjät jakavat Vercelin IP:n.
Koodin oma kirjaus Open-Meteon ilmaisrajasta on 10 000/vrk (ja
ilmaisrajapinta on ei-kaupalliseen käyttöön); FMI:llä on omat
IP-kohtaiset rajansa. Välimuistiavain on koko pisteerän osoite, joten eri
näkymät eivät jaa osumia. → Laatat oikeaan CDN:ään (Vercel, R2 tai
vastaava); palvelimelle pistekohtainen välimuisti pyöristetyllä
koordinaatilla; varatien pistemäärälle katto.

**L4. Päätöskynnykset ovat hajallaan ja ristiriidassa (M).**
Samaa päätöstä tekee viisi taulukkoa: `windBadge` (<4 "Tyyni – ei sovi",
<6 rajatuuli, <9 ajettava, <13 hyvä, <18 kova, ≥18 liian kova, 13782),
`spotIndexSelite` (<2 "Tyyntä", <5 "Liian heikko", ≥17 "Kova", ≥22
"Liian kova", 13602), indeksin nopeuskäyrä (huippu 11–14, nolla 22:ssa),
puuskaisuus kolmella rajalla (`gustIndex` 1,2/1,5, indeksi 1,4, selite
noin 1,8) ja kaavion foilausraja 6 m/s. Sama hetki voi olla "Tyyni"
7,6 solmussa. Indeksin katto on 60 + 30 = **90**, mutta kortti sanoo "/ 100";
kommentit kuvaavat vanhoja asteikkoja (1–10, 50 p, −20 p). → Yksi
kynnystaulukko ja yksi sanasto, indeksi skaalattuna 0–100. Myöhemmin
käyttäjän profiili (paino tai siiven koko), koska kynnys on eri kevyelle
ja raskaalle ajajalle.

**L5. Parhaat ajankohdat laskee eri datasta ja näyttää mennyttä (S–M).**
`ForecastPanel._compute` lukee `spot.wx`:ää (23206–23250), ei
`KorttiSarjat`in Paras-sarjaa jota kortti ja merkit lukevat, joten
paneelin lukema eroaa kortin lukemasta. Menneitä tunteja ei suodateta:
mitattuna kello 19 paneeli näytti saman päivän 16–18 ja 15–17. Vain
näkymässä olevat spotit lasketaan (`bounds.contains`) kertomatta sitä.
Napautus kirjoittaa aikajanan ohi `_tlValitseIdx`:n (23333–23344) eikä
pysäytä toistoa — sääntöjen kieltämä viides polku. → Paras-sarja, t ≥ nyt,
kaikki spotit (tai suosikit) ja maininta rajauksesta, valinta
`_tlValitseIdx`:n kautta.

**L6. Lisenssit ja lähdemaininnat julkaisua varten (S koodina + selvitys).**
Maininta on vain asetuksissa (`attributionControl: false`) ja kertoo
"Esri … Säädata: Ilmatieteen laitos, Open-Meteo". Puuttuvat MET Norway ja
ECMWF (molemmat CC BY 4.0), DWD (ICON), NOAA (GFS), FVH/UiRas, Surfing ry
(Mellsten), dlarah.org (Laru) ja Carton varapohja. Esrin ja Carton
pohjakarttojen ehdot sekä Open-Meteon ilmaisrajapinnan ei-kaupallisuus
on tarkistettava ennen julkista käyttöä, ja kaavittujen asemien
(Mellsten, Laru) käytöstä on hyvä kysyä lupa. → Tarkistuslista, näkyvä
ⓘ kartalle Tietoa-näkymään, avaimet sinne missä vaaditaan.

**L7. Sovellus ei päivity taustalta palatessa (S–M).**
`Saalaatat.alusta()` ajetaan vain `main()`issa (24247). Tunnin välein
ajettava `scheduleRefresh` hakee pisteet mutta ei laattaluetteloa, ja
`visibilitychange` vain pysäyttää toiston (21670). Kotivalikon appi pysyy
puhelimen muistissa päiviä, ja ajastimet pysähtyvät taustalla: aamulla
avattu appi voi näyttää illan varastoajoa ja illan valittua tuntia
nykyhetkenä. → Näkyviin palatessa (> N min): luettelo uudelleen,
nykyhetki uudelleen (jos käyttäjä ei ollut siirtänyt valintaa),
havainnot uudelleen.

**L8. Tuotantobuild kuljettaa kommentit mukanaan (S–M).**
`dist/index.html` 1 150 kB, gzip 391 kB. Sama tiedosto inline-JS ja -CSS
minifioituna (rolldown `minifySync` ilman nimien lyhennystä +
lightningcss) ja HTML-kommentit pois: **522 kB, gzip 152 kB — 61 %
vähemmän siirrettävää**. Lähde pysyy ennallaan. → Vite-lisäosa, joka
minifioi inline-lohkot buildissa. CLAUDE.md:n mukaan tarkistus
`new Function(lohko)` + lataus selaimessa.

**L9. Ei automaattisia testejä eikä virheseurantaa (M).**
`package.json`issa ei ole testiskriptiä, ja CI rakentaa vain säälaatat.
CLAUDE.md toteaa että build menee läpi syntaksivirheen kanssa. Selaimen
virheistä ei jää jälkeä mihinkään. → CI:hin buildi + inline-skriptin
jäsennystarkistus + Playwright-savutesti (latausruutu poistuu alle 10
s:ssa, kortti ja asetukset aukeavat, ei `pageerror`ia); kevyt
virheraportointi (oma `/api`-päätepiste tai palvelu).

**L10. Rajapintojen suojaus (M).**
Kaikki 11 funktiota vastaavat `Access-Control-Allow-Origin: *` ilman
pyyntörajoitusta, joten kuka tahansa voi käyttää niitä omasta
sovelluksestaan — sovelluksen kiintiöllä ja Vercelin funktioajalla
(`malli.js` lukee S3:a 30 s:n funktiossa). `innerHTML`ia käytetään 101
kertaa, ja osa sisällöstä tulee ulkoisista vastauksista (asemanimet,
kaavitut sivut). → CORS omaan originiin, kevyt rajoitin, ulkoisten
merkkijonojen escapointi tarkistettava.
