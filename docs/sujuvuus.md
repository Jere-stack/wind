# Työpöydän sujuvuus — mittaus, windy.com ja strategia

Zoomauksen ja panoroinnin raskaus työpöydän selaimessa: mitä mitattiin,
mitä windy.com tekee toisin, mitä julkiset repot opettavat, ja
vaihtoehdot suosituksineen. **Tämä on päätösasiakirja, ei toteutus** —
mitään sovelluskoodia ei ole muutettu.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan kun työ koskee zoomin tai panoroinnin raskautta,
> erityisesti työpöydällä.

Reunaehto käyttäjältä: **laatu ja resoluutio eivät saa heiketä.** Kaikki
alla olevat vaihtoehdot on arvioitu sitä vasten; ne jotka rikkoisivat
sen, on merkitty.

## Tiivistelmä

1. **Suurin yksittäinen vika on työpöytäkohtainen ja mitattu:** jokaisen
   panoroinnin ja zoomin jälkeen `drawColorField()` →
   `SaaLaattaKerros.paivitaSisalto()` maalaa **kaikki** muistissa olevat
   lämpökarttalaatat uudelleen, kaikilta tasoilta — vaikka niiden sisältö
   ei muuttunut lainkaan (laatta on kiinteä maantieteellinen neliö;
   sisältö riippuu vain hetkestä, kentästä ja rampista). Laattojen määrä
   kasvaa ruudun pinta-alan mukana: puhelimella 12–45, 1920×1080:lla
   77–308, 2560×1440:llä 576–746. Yksi 500 px:n hiiriveto maalasi
   1920×1080:lla 308 laattaa ja 2560×1440:llä 612 — eikä yhdenkään
   sisältö muuttunut.
2. **Aikajanan askel maalaa neljä kertaa enemmän kuin näkyy:** 1920×1080
   170–187 laattaa askeleelta, niistä ruudulla 40–45.
3. **Eleen AIKANA pääsäie on enimmäkseen vapaa** (karttatapahtumat ~1 ms
   per hiiren liike). Jos kartta nykii itse vedon aikana eikä vasta sen
   jälkeen, syy on todennäköisesti GPU:lla — koko ruudun
   partikkelicanvas 2×-tarkkuudella, `plus-lighter`-sekoitus ja
   lämpökartan CSS-`blur()` joka ruudussa. Sitä ei voi mitata kontissa
   (ei GPU:ta), joten se varmistetaan omalla koneella (**Vaihe 0**).
4. **Windy on eri arkkitehtuuri:** v51.2.1 ajaa MapLibre GL JS 5.21.1:tä
   Leaflet-yhteensopivan julkisivun alla. Pohjakartta, sääkerros ja
   partikkelit piirretään samassa WebGL-ruudussa GPU-tekstuureista;
   DOM-laattoja ei ole.

**Suositus:** ensin A1 + A4 + A3 (pikselilleen sama kuva, 1–2 päivää,
poistaa eleen jälkeisen nykäyksen), sitten Vaihe 0 omalla koneella, ja
sen tuloksen mukaan B1 (sulava rullazoom) ja joko B2 (partikkelit
WebGL:llä) tai B3 (sumennus varjostimeen). C1 (yksi WebGL-peite) vasta
jos A+B ei riitä. C2:ta (MapLibre-siirto) ei suositella nyt.

## Mittausasetelma

- Tuotantobuild (`npm run build` + `vite preview`), Chromium 1194
  headless, `?perf=1`, **`hasTouch: false`** (työpöytäpolku, `TYOPOYTA`
  tosi). Puhelinvertailu `hasTouch: true` + `isMobile`.
- Ruudut: 1920×1080 @1, 2560×1440 @1, 1512×982 @2 (MacBook 14"),
  390×844 @3 (puhelin).
- Kontissa ei ole GPU:ta: WebGL on SwiftShader, jolloin `GLKentta`
  kieltäytyy ja laatat piirtyvät CPU-polulla (128 texeliä). **Laskurit
  (montako laattaa, montako kutsua) ovat tarkkoja; millisekunnit ovat
  kontin suorittimen eivätkä kerro laitteen aikaa.** Oikealla koneella
  laatat piirtyvät GL-polulla, jonka hinta laattaa kohti on toinen
  (varjostin + `drawImage`-kopio GL-kankaalta 2D-kankaalle) mutta
  laattojen MÄÄRÄ on sama.
- Instrumentointi käärii sovelluksen omat metodit ajossa
  (`State.saaKerros.paivitaSisalto`, `_piirra`, `ViewportGrid`in
  välimuistimetodit, `map.fire`) — sovelluskoodiin ei kosketa.
  `renderLoop`in aika mitataan käärimällä `requestAnimationFrame`
  `addInitScript`illä ennen sivun skriptiä.
- CPU-profiili CDP:n `Profiler`illa 200 µs näytteellä.

## Mitä mitattiin

### Laattojen uudelleenmaalaus per ele

Solu = *laattoja maalattiin uudelleen / kontin aika `paivitaSisalto`ssa*.
"DOM" = lämpökarttalaattojen `<canvas>`-määrä eleen jälkeen.

| ruutu | DOM | hiiriveto 500 px | rulla, 2 napsautusta | rulla, 2 napsautusta ulos |
|---|---|---|---|---|
| 390×844 @3 (puhelin) | 12–25 | 75 / 41 ms (3 kutsua) | 45 / 25 ms | — |
| 1512×982 @2 | 24–144 | 288 / 128 ms | 189 / 125 ms | 234 / 88 ms |
| 1920×1080 @1 | 77–308 | **308 / 161 ms** | 494 / 221 ms · 1210 / 471 ms | 906 / 415 ms |
| 2560×1440 @1 | 576–746 | **612 / 253 ms** | 1011 / 540 ms · 1722 / 944 ms | 1694 / 709 ms |

Kutsupaikat (pinosta luettuna): `zoomend`-käsittelijä
(`WindTexture.build(...).then(drawColorField)`), `_rakennaKentta`
(datahaun perässä) ja `_heatmapCatchUp`. Yksi rullazoom laukaisee niistä
2–4. Mikään niistä ei muuta laatan sisältöä — uudet laatat piirtyvät
jo kertaalleen `createTile` → `_valmista` → `_piirra` -polussa.

Miksi määrä kasvaa näin: `REUNUS` 0,6 maalaa 2,2-kertaisen alan
kumpaankin suuntaan (4,84× ruudun pinta-ala), `keepBuffer: 2` pitää
ohitetut, ja edellisten tasojen laatat jäävät `_levels`iin. Kaikki
maalataan uudelleen, myös piilotetut tasot.

### Aikajanan askel

`_tlValitseIdx(i+1)`, viisi askelta, Helsinki:

| ruutu | maalataan / askel | niistä ruudulla | kontin aika |
|---|---|---|---|
| 390×844 @3 | 32–45 | — | 11–30 ms |
| 1920×1080 @1 | 170–187 | 40–45 | 58–92 ms |
| 2560×1440 @1 | 299 | 77 | 56–153 ms |

Kolme neljäsosaa aikajanan kenttätyöstä menee laattoihin joita ei näy.
Sama osuu raahaukseen ja playhin, eli juuri sinne missä
`docs/partikkelit.md` sanoo aikajanan olevan "lepotilan pohjaan sidottu"
— se mittaus tehtiin puhelimen ruudulla, jossa laattoja on 32.

### Pääsäikeen profiili, 1920×1080 @1

Kolme hiirivetoa (600 px): `loadViewport` yhteensä 682 ms, josta
`_restoreCache` (localStorage + `JSON.parse`) **396 ms**;
`paivitaSisalto` 215 ms; `renderLoop` 345 ms; `updateTimelineToCenter`
136 ms (siitä `_tlPaivitaPalkit` 87 ms); `_ts` (päivämäärien jäsennys)
88 ms. Yksi 600 px veto käynnisti kesken eleen `loadViewport`in
8 kertaa (kontin hitaassa tahdissa veto kesti sekunteja; oikealla
laitteella 1–2).

Neljä rullanapsautusta sisään ja neljä ulos: 93 pitkää tehtävää, yhteensä
11,3 s 12,3 sekunnista. Suurimmat: laattojen uudelleenmaalaus 1 430 ms,
`putImageData` 188 ms, **`_tasoVuoro` 122 ms** (käy läpi kaikki laatat
jokaisella `tileload`-tapahtumalla → neliöllinen), `localStorage.setItem`
121 ms + `_saveCache` 120 ms, `_ts` 102 ms.

### Eleen aikana

| mitä | 1920×1080 @1 |
|---|---|
| `move`-tapahtuman käsittelijät | 30 tapahtumaa, 31 ms yhteensä (~1 ms / liike) |
| `renderLoop` JS / ruutu | mediaani 1,3–5,7 ms, p90 4,8–9,0 ms, 360 partikkelia |
| partikkeleita tavoite | 800 (katto), `PerfTracker` pudotti 360:een kontin hitauden takia |

`renderLoop`in oma aika jakautuu: Path2D-rakennus (`closePath`,
`quadraticCurveTo`, `arc`, `lineTo`) noin 57 %, `nauha`n laskenta 20 %,
silmukka 17 %. Itse `fill` on pääsäikeellä 3 % — rasterointi tapahtuu
GPU-prosessissa, jota tämä profiili ei näe.

### localStorage

Yhdessä ajossa localStorage oli jo käynnistyksen jälkeen **4,3 MB**
(28 `fg_`-avainta); toisissa 0,15–0,2 MB ennen ensimmäistä tallennusta.
Selaimen raja on noin 5 MB, jonka jälkeen `_pruneOldCache` poistaa
puolet.
Kutsukohtaisesti `_restoreCache` 0,2–16 ms ja `_saveCache` 4–32 ms, ja
kumpikin on synkroninen pääsäikeellä. localStorage myös luetaan
kokonaan muistiin ensimmäisellä käytöllä, eli koko 4 MB jäsennetään
käynnistyksessä.

### Mitä EI voitu mitata

GPU-työ: partikkelicanvasin tyhjennys ja täyttö, sen `plus-lighter`-
sekoitus kartan päälle, lämpökarttasäiliön `filter: blur() saturate()`
ja 170–746 laattakankaan kompositointi. Aiempi puhelinmittaus sanoi
sekoituksen ja sumennuksen olevan "ilmaisia" — se tehtiin 1,3 Mpx:n
kankaalla ja kontin CPU-kompositorilla. Työpöydällä pikseleitä on
moninkertaisesti:

| ruutu | partikkelikangas (meillä, DPR ≤ 2) | Windyn jälkipuskuri |
|---|---|---|
| 390×844 @3 | 780×1688 = 1,3 Mpx | 312×675 (mobiili) |
| 1920×1080 @1 | 1920×1080 = 2,1 Mpx | 1920×1080 = 2,1 Mpx |
| 1512×982 @2 | 3024×1964 = **5,9 Mpx** | 1210×786 = 1,0 Mpx |
| 2560×1440 @1,5 (4K 150 %) | 3840×2160 = **8,3 Mpx** | 2048×1440 = 2,9 Mpx |

Se on Vaihe 0:n kysymys.

## Miksi juuri työpöytä

Puhelimella laattoja on 12–45 ja kangas 1,3 Mpx; kaikki aiemmat
sujuvuusmittaukset (`docs/partikkelit.md`, `docs/eleet.md`) on tehty
siinä asetelmassa. Työpöydällä **sama koodi tekee 5–25-kertaisen
määrän laattatyötä joka eleen jälkeen** ja piirtää 2–6-kertaisen
kankaan joka ruudussa. Kumpikaan ei näkynyt puhelinmittauksissa, koska
ne skaalautuvat ruudun pinta-alan mukana.

## windy.com — mitä se tekee (luettu sen omasta koodista)

Lähde: `https://www.windy.com/v/51.2.1.ind.3f7b/` — `leaflet-gl.js`
(1,2 MB), `index.js` (396 kt) ja `plugins/gl-particles.js` (31 kt),
haettu 2026-09-23. (Aiempi merkintä `docs/lampokartta.md`:ssä tunnisti
jo MapLibren; tämä tarkentaa partikkelit ja zoomin.)

| asia | Windy v51 | FoilSpot nyt |
|---|---|---|
| karttamoottori | Leaflet GL (versiosta 49): MapLibre GL JS 5.21.1:n haara + Leaflet-API uudelleenkirjoitettuna | Leaflet 1.9.4 |
| pohjakartta | GL:ssä, samassa ruudussa | DOM-kuvalaatat |
| sääkerros | data-PNG → FBO:n kautta väritetty tekstuuri kerran; joka ruudussa piirretään laattaverkot MapLibren matriisilla (`_drawTiles`) | 256² `<canvas>` per laatta, 170–746 kpl työpöydällä, CSS `blur()` + `saturate()` säiliölle |
| zoom | jatkuva, `zoomSnap: 0`, rulla ja trackpad sulavasti | rulla puolen tason askelin, jokainen 250 ms CSS-siirtymä |
| partikkelien simulointi | GPU: sijainti tilatekstuurissa (RGBA-koodattu), siirto fragmenttivarjostimessa, ping-pong-FBO | CPU, JS-silmukka |
| partikkelien piirto | GPU: nelikulmio edellisestä sijainnista nykyiseen, yksi piirtokutsu, jopa 15 000 kpl (mobiili × 0,5) | Canvas 2D, Path2D-nauhat, 10 `fill`iä, enintään 800 kpl |
| jälki | pikselipuskuri jota himmennetään joka ruudussa (`fadeScale` ≤ 0,98) | geometria (20 pistettä / partikkeli), piirretään uudelleen joka ruudussa |
| jälkipuskurin tarkkuus | CSS-pikselit, enintään 2048 px, retinalla × 0,8 | laitteen pikselit, DPR enintään 2 |
| zoomin aikana | oma piirtosilmukka katkaistaan (`zoomstart` → pause, `zoomend` → resume) | liike jatkuu (mitattu ja päätetty, ks. `docs/eleet.md`) |
| datahaku | `moveend`issä | `loadViewport` myös kesken eleen |

Windyn sujuvuus ei tule yhdestä temposta vaan siitä, että **zoom on
pelkkä matriisin muutos**: mikään ei rakennu uudelleen, ja joka ruudun
työ on muutama piirtokutsu. Kaksi Windyn valintaa ovat meidän
reunaehtojemme vastaisia eikä niitä ehdoteta: partikkelien pysäytys
zoomin ajaksi (kokeiltu ja peruttu, `docs/eleet.md`) ja jälkipuskuri
CSS-tarkkuudella (heikentää resoluutiota).

## Julkiset lähteet (GitHub)

Kloonattu ja luettu 2026-09-23.

| repo | lisenssi | viimeisin | tekniikka | mitä siitä otetaan |
|---|---|---|---|---|
| `mapbox/webgl-wind` | ISC | 2026-06 | GPU-partikkelit: tila tekstuurissa, päivitys fragmenttivarjostimessa, jälki himmenevänä näyttötekstuurina (`fadeOpacity` 0,996) | Windyn partikkelien esikuva. Jälkimalli ei sovi meille (venyy zoomissa), tilatekstuuri sopii |
| `weatherlayers/weatherlayers-gl` | MPL-2.0 tai kaupallinen | 2026-09 | deck.gl-kerroksia; `ParticleLayer` pitää **jäljen geometriana GPU-puskurissa** (`numParticles × maxAge` pistettä, WebGL2 transform feedback), piirto viivoina | Lähin esikuva B2:lle: sama jälkimalli kuin meillä, mutta GPU:lla. Vaatii deck.gl:n — otetaan malli, ei kirjastoa |
| `sakitam-fdd/wind-layer` | MIT | 2026-03 | 1.x Canvas 2D (earth-johdannainen, myös Leaflet), 2.x WebGL vain mapbox/maplibre/maptalks | Vahvistaa: WebGL-versiota ei ole Leafletille valmiina |
| `onaci/leaflet-velocity` | CSIRO (BSD-tyyppinen) | 2023-03 | Canvas 2D; `zoomstart` pysäyttää, `movestart` tyhjentää, `moveend` piirtää | Juuri se malli josta FoilSpot on jo päässyt ohi |
| `cambecc/earth` | MIT | 2016 | Canvas + D3; kentän interpolointi **viipaloituna** (`MAX_TASK_TIME` 100 ms, sitten luovutus) | Viipalointi: raskas työ paloina eikä yhtenä tehtävänä (A2, A3) |
| `astrosat/windgl` | ISC | 2020 | webgl-wind Mapboxin custom layerina, laatoitettu data | Hylätty projekti, ei jatkoon |
| `mutsuyuki/Leaflet.SmoothWheelZoom` | MIT | 2026-03 | Rulla asettaa tavoitezoomin, `map._move` lähestyy sitä joka ruudussa (30 %/ruutu), ilman CSS-siirtymää | B1:n malli |
| `maplibre/maplibre-gl-leaflet` | ISC | 2026-09 | MapLibre Leafletin kerroksena; animoidussa zoomissa GL-kangasta venytetään CSS:llä (`_animateZoom`), nipistyksessä `jumpTo` joka tapahtumalla | Todistaa: GL Leafletin sisällä perii Leafletin zoom-mallin |
| `zakjan/deck.gl-leaflet` | MIT | 2024-12 | deck.gl Leafletissa; `zoomanim` → `setTransform` säiliölle | Sama havainto: ei jatkuvaa GL-zoomia Leafletin animaatiossa |
| `windycom/windy-plugins` | ISC | 2026-07 | Windyn liitännäis-API; muutosloki: "the new Leaflet GL map library introduced in client v49.0.0" | Ajoittaa Windyn siirron: Leaflet → Leaflet GL versiossa 49. Leaflet GL:n dokumentaatio (`windycom.github.io/LeafletGL`) kuvaa sen MapLibre GL JS:n haarana, josta vektoriominaisuudet on poistettu, ja Leaflet-API:n TypeScript-uudelleenkirjoituksena; "custom Layer types based on old Leaflet will not work". Lähdekoodia ei ole julkaistu |

## Vaihtoehdot

Jokaisesta: mitä, mitattu peruste, vaikutus, työ, riski, laatu. Työmäärä
on arvio.

### Vaihe 0 — mittaus omalla koneella (10 min, ei koodia)

Ennen B- ja C-tason valintaa pitää tietää onko työpöydän raskaus
eleen aikana GPU:lla vai pääsäikeellä.

1. `https://wind-delta.vercel.app/?perf=1` työpöydän selaimessa
   tavallisella ikkunakoolla.
2. Panoroi ja rullaa 10 s. Kirjaa fps, "huippu", "ele" ja "jälki".
3. Toista kolmesti: *Partikkelit ✕*; *Lämpökartta ✕* (partikkelit
   takaisin); molemmat ✕.
4. Chromessa: DevTools → Performance → nauhoita 5 s panorointia.
   Punaiset pitkät tehtävät **Main**-raidalla = pääsäie (A-taso auttaa);
   pitkät palkit **GPU**- tai **Compositor**-raidalla = GPU (B2/B3/C1).

Tulkinta: partikkelit pois → sulava ⇒ B2. Lämpökartta pois → sulava ⇒
B3 tai C1. Eleen aikana sulava mutta nykäys pysähtyessä ⇒ A-taso.

### A — pikavoitot: sama kuva pikselilleen

**A1. Laattaa ei maalata uudelleen kun vain näkymä muuttuu.**
`paivitaSisalto` saa sisällön allekirjoituksen (valittu hetki,
`activeLayer`, rampin/värisokeustilan/voimakkuuden versio, pohjakartan
sekoitustila, varaston versio). Sama allekirjoitus → ei tehdä mitään.
Laatta merkitään (`el._sig`) kun se maalataan.
- Peruste: yllä olevat taulukot — 308–612 turhaa maalausta per veto,
  494–1722 per zoomtaso työpöydällä.
- Vaikutus: eleen jälkeinen nykäys poistuu (kontissa 160–944 ms per
  ele); laitteella GL-polun `drawImage`-kopiot putoavat nollaan
  panoroinnissa ja zoomissa.
- Työ: ½–1 päivää. Riski: matala — jos allekirjoituksesta puuttuu jokin
  syöte, laatta jää vanhaan sisältöön. Mittari: vaihda jokaista syötettä
  yksi kerrallaan ja tarkista että jokainen laatta vaihtaa sisältönsä.
- Laatu: sama kuva, koska laatan sisältö on funktio samoista syötteistä.

**A2. Kun sisältö vaihtuu (aikajana, play, asetus), näkyvät ensin.**
Nykytason ruudulla olevat laatat maalataan heti, reunuslaatat
viipaloituna seuraavissa ruuduissa (budjetti esim. 4 ms/ruutu, earthin
malli), ja muiden tasojen laatat merkitään vanhoiksi ja maalataan kun
taso tulee näkyviin — tai karsitaan.
- Peruste: aikajanan askel 170–299 laattaa, näkyvissä 40–77.
- Vaikutus: aikajanan askel työpöydällä noin ¼ nykyisestä.
- Työ: 1 päivä. Riski: keskitaso — "laatta ilmestyy valmiina" ja
  "tasan yksi taso näkyvissä" (`docs/lampokartta.md`) on pidettävä:
  vanhaksi merkitty laatta ei saa tulla ruudulle maalaamattomana.
- Laatu: sama lopputila; välitilassa reunuslaatta voi olla ruudun tai
  kaksi vanha jos käyttäjä raahaa aikajanaa JA panoroi samaan aikaan.

**A3. Raskas tausta pois eleen päältä.**
(a) `fg_`-välimuistin tallennus `requestIdleCallback`iin ja luku vain
pisteille joita muistissa ei vielä ole — tai koko välimuisti
IndexedDB:hen (asynkroninen, ei 5 MB:n rajaa, ei synkronista jäsennystä
käynnistyksessä). (b) `_ts`: kaikilla rajapintapisteillä on sama
aika-akseli, joten jäsennetty taulukko avaimella
`time[0] + time.length`. (c) `_vpEleenAikana`-haun kynnykset
työpöydälle ruudun mukaan.
- Peruste: `_restoreCache` 396 ms kolmessa vedossa, `setItem` +
  `_saveCache` 241 ms zoomsarjassa, `_ts` 88–102 ms, localStorage 4,3 MB.
- Työ: ½–1 päivää. Riski: matala; IndexedDB-siirto keskitaso
  (käynnistyksen polku, `docs/data.md` "Käynnistys: välimuisti ruudulle
  ennen verkkoa").
- Laatu: ei vaikutusta kuvaan.

**A4. `_tasoVuoro` kerran ruudussa, ei kerran laatalla.**
Nyt se on kuuntelijana `load loading tileload tileunload` ja käy joka
kerta läpi kaikki laatat. Kootaan kutsut `requestAnimationFrame`iin.
- Peruste: 122 ms self-aikaa zoomsarjassa, neliöllinen laattamäärän
  suhteen.
- Työ: 1–2 tuntia. Riski: matala; mittari on valmiina (`_updateLevels`
  -kääre, `docs/lampokartta.md` "Zoomin välkky uudestaan").

### B — sama ulkoasu, uusi toteutus

**B1. Sulava rullazoom ja trackpad-nipistys.**
Rulla ja trackpad eivät enää käynnistä 250 ms:n CSS-animaatiota
askeleittain, vaan asettavat tavoitezoomin jota kartta lähestyy joka
ruudussa `map._move`lla — sama putki jota nipistys jo käyttää
(`nipistysAlkaa`/`nipistysPaattyy`, alipikselikäsittely,
`will-change`, zoom-inertia, `updateWhenZooming: false`). Hiiren rulla
päättyy yhä puolikkaiden hilaan (rullaZoomin mitattu sääntö:
rulla on diskreetti syöte); trackpadin nipistys (`ctrlKey`-rulla)
päättyy sinne mihin sormet jättävät (`zoomSnap: 0` -sääntö).
- Peruste: Windy/MapLibre ja `Leaflet.SmoothWheelZoom`; nykyinen rulla
  on sarja erillisiä animaatioita, joista jokainen päättyy `zoomend`iin
  ja sen työhön.
- Vaikutus: tuntuma. Ilman A1:tä jokainen välietappi maksaisi
  laattamaalauksen — **A1 on B1:n edellytys**.
- Työ: 1–2 päivää. Riski: keskitaso — lämpökartan peitto (`REUNUS`
  kattaa yhden tason) ja partikkelien rekisteröinti on mitattava
  uudelleen tällä eleellä; Safari ja Firefox erikseen.
- Laatu: sama.

**B2. Partikkelit WebGL2:lla, sama nauhageometria.**
Simulaatio pysyy JS:ssä (se on halpa), mutta piirto siirtyy: 800 × 20
pisteen historiat kirjoitetaan joka ruudussa yhteen `Float32Array`hin,
ja verteksivarjostin laajentaa ne kapeneviksi nauhoiksi (1 − t², pyöreä
kärki etäisyyskentällä). Yksi piirtokutsu. Kangas ja sen
`plus-lighter`-sekoitus pysyvät ennallaan, joten kompositointi ei muutu.
- Peruste: Path2D-rakennus on 57 % `renderLoop`in pääsäieajasta, ja
  käyrien rasterointi GPU-prosessissa on tämän päälle (ei mitattavissa
  täällä). WeatherLayers GL todistaa mallin: geometrinen jälki GPU:lla.
- Vaikutus: pääsäie vapautuu partikkeleilta lähes kokonaan; resoluutio
  voi jäädä 2×:iin tai jopa nousta laitteen omaan. Partikkelimäärän voi
  nostaa ilman lisähintaa (Windy piirtää 15 000).
- Työ: 2–4 päivää. Riski: keskitaso — ulkoasun on vastattava nykyistä
  (pikselivertailu kuten `glruudulla.mjs`), ja jäljen säännöt
  (`JalkiViritys.maxPx` 26, tasainen tiheys, ruutukoordinaatit) on
  pidettävä sellaisinaan.
- Laatu: sama tai parempi (reunanpehmennys varjostimessa, ei
  resoluutiokattoa).
- **Ei** OffscreenCanvas-työntekijää: se piirtäisi eri tahdissa kuin
  pääsäikeen CSS-muunnos, ja kerrosten rekisteröinti on mitattu
  0,0–0,5 px:iin (`docs/partikkelit.md`). Yksi ruutu viivettä vedossa
  olisi 10–30 px.

**B3. Sumennus ja saturaatio varjostimeen, CSS-`filter` pois.**
`saturate()` on lineaarinen värimatriisi ja kulkee LUTiin tarkasti;
2 px:n sumennus tehdään datan avaruudessa varjostimessa (solmuhilassa on
jo 2 solmun reunus naapurilaatan puolelle, joten sauma ei synny).
- Peruste: säiliön `filter` on GPU-passi joka ruudussa koko näkyvän alan
  yli panoroinnin ja zoomin aikana. Ei mitattavissa kontissa — tehdään
  vain jos Vaihe 0 osoittaa lämpökartan.
- Työ: 1–2 päivää. Riski: keskitaso (pikselivertailu nykyistä vastaan,
  CPU-varatie samaan).
- Laatu: tavoite pikselilleen sama.

### C — rakenteellinen, Windyn arkkitehtuuri

**C1. Yksi WebGL-peite Leafletin päälle.**
Lämpökartta piirretään joka ruudussa yhteen koko ruudun GL-kankaaseen
GPU-tekstuureista (säälaatta = tekstuuri, bikuubinen varjostin on jo
`GLKentta`ssa), ja partikkelit samaan kontekstiin. Zoom-animaation
aikana muunnos luetaan kellosta joka ruudussa, kuten partikkelit jo
tekevät (`#c-wind-kello`).
- Poistuu: 170–746 laattakangasta, laattakohtaiset `drawImage`-kopiot,
  `REUNUS`, `_tasoVuoro`, esilatauksen erikoistapaukset, CSS-sumennus.
  Zoomissa kuva on joka ruudussa oikeassa mittakaavassa eikä venytetty
  edellinen taso.
- Työ: 1–2 viikkoa. Riski: korkea — `SaaLaattaKerros`in mitatut
  korjaukset (peitto, välkky, esilataus) korvautuvat, ja kaikki on
  mitattava uudelleen: peitto joka ruudussa, rekisteröinti pohjakarttaan,
  `plus-lighter`-summa, kontekstin menetys.
- Laatu: sama tai parempi. Tämä on se mitä Windy tekee MapLibren sisällä.

**C2. Siirto MapLibre GL JS:ään (Windyn tie).**
Koko kartta yhteen WebGL-ruutuun. Windy teki tämän versiossa 49 ja
kirjoitti sitä varten oman kirjaston (Leaflet GL: MapLibren haara +
Leaflet-API uudelleen), jotta muu koodi säilyi. Kirjasto ei ole julkinen,
eikä se tue vanhoja Leaflet-kerrostyyppejä — eli juuri niitä joihin
tämän sovelluksen eletyö on kirjoitettu.
- Työ: viikkoja. Riski: erittäin korkea — `docs/eleet.md`:n koko
  eletyö (One Euro -suodin, alipikselikäsittely, zoom-inertia,
  tuplanapautus, uloin raja), merkit, sadetutka ja pohjakartan
  sekoitus tehtäisiin uudelleen, ja Esri-rasteripohjan värityö on
  varmistettava uudessa putkessa.
- Ei suositella nyt: A+B+C1 saa saman hyödyn murto-osalla riskistä.

## Suositus ja järjestys

1. **A1 + A4** (1 päivä) — suurin mitattu voitto, sama kuva, matala
   riski.
2. **A3** (½–1 päivää) — localStorage ja päivämäärät pois eleen päältä.
3. **Vaihe 0 omalla koneella** A1:n jälkeen — mitä eleen aikana vielä
   tuntuu.
4. **B1** — sulava rulla ja trackpad; tuntuman suurin ero Windyyn
   työpöydällä, ja vasta A1:n jälkeen kannattava.
5. Vaiheen 0 mukaan **B2** (partikkelit) tai **B3** (sumennus).
6. **A2** jos aikajanan raahaus tuntuu työpöydällä raskaalta.
7. **C1** vain jos 1–5 eivät riitä.

## Mitä ei ehdoteta — ja miksi

- **Partikkelikankaan resoluution lasku** (Windy: CSS-pikselit, retinalla
  × 0,8). Toimisi, mutta rikkoo reunaehdon.
- **Partikkelien pysäytys eleen ajaksi** (Windy, leaflet-velocity).
  Toteutettu, mitattu hyväksi ja peruttu käyttökokemuksen perusteella
  (`docs/eleet.md` "Kaksi kokeilua jotka eivät jääneet").
- **Pikselijälki himmennyksellä** (webgl-wind, Windy). Venyy zoomissa;
  jälki on geometriaa juuri siksi (`docs/partikkelit.md` "Jälki on
  geometriaa, ei pikseleitä").
- **OffscreenCanvas-työntekijä partikkeleille.** Eri tahti kuin kartan
  CSS-muunnos → kerrokset liukuvat toistensa suhteen vedossa.
- **deck.gl-leaflet / maplibre-gl-leaflet.** Leafletin animoidussa
  zoomissa molemmat venyttävät GL-kangasta CSS:llä ja piirtävät vasta
  lopuksi — ei jatkuvaa GL-zoomia, ja iso riippuvuus lisää.
- **Pelkkä `REUNUS`in pienennys työpöydällä.** Vähentäisi laattoja
  mutta rikkoisi mitatun peiton ulos zoomatessa (`docs/lampokartta.md`:
  reunus kattaa tasan yhden tason). A1 poistaa saman kustannuksen
  koskematta peittoon.
