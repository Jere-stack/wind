# FoilSpot v7

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (Leaflet) + tuuliennusteet
(oma säälaattavarasto, FMI HARMONIE, Open-Meteo, FMI-havaintoasemat) yhdessä
self-contained HTML-sivussa.

## Ajokomennot

```bash
npm install       # asenna riippuvuudet
npm run dev       # käynnistä Vite dev-serveri (http://localhost:5173)
npm run build     # tuota tuotantobuild hakemistoon dist/
npm run preview   # esikatsele tuotantobuildia paikallisesti
npm run saadata   # rakenna säälaatat (tools/tiilet.mjs)
```

## Rakenne

- `index.html` — koko sovellus: CSS, HTML ja JS yhdessä tiedostossa (ei erillistä
  `src/`-hakemistoa). Leaflet ladataan CDN:stä `<script>`-tagilla.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  Kruunuvuorenselän ja Uiraan mittausdata -proxyt). ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
- `tools/tiilet.mjs` — säälaattojen rakennus AWS Open Datan ECMWF-datasta.
  Ajetaan GitHub Actionsissa neljästi vuorokaudessa (`.github/workflows/`).
- `public/sw.js` — service worker. `__BUILD_ID__` korvataan buildissa.
- `vite.config.js` — build-asetukset sekä `vercel-api-dev`-plugin, joka ajaa
  `api/*.js`-funktiot myös `npm run dev`- ja `npm run preview` -servereissä.
- `vercel.json` — Vercel-deployn asetukset.
- `docs/*.md` — muistiinpanot tehdyistä päätöksistä ja mittauksista. **Ei ladata
  automaattisesti** — lue se tiedosto jonka aihetta työ koskee (hakemisto alla).

## API-osoitteet ja deploy

Frontend käyttää vakiota `API_BASE = '/api'`, eli funktiot haetaan aina samasta
originista kuin sivu — niin tuotannossa kuin devissä. Koodissa ei ole yhtään
absoluuttista host-osoitetta omaan palveluun, joten sivu ja API ovat aina samaa
versiota.

Vercel ajaa `npm run build`:n ja julkaisee `dist/`-hakemiston sekä
`api/`-funktiot. Deployn tulee tapahtua tästä reposta, jotta sivu ja sen
`/api`-funktiot pysyvät samassa versiossa.

Säälaatat ovat orpossa `saadata`-haarassa (aina tasan yksi committi,
pakkopäivitys) ja ne haetaan `raw.githubusercontent.com`:sta.

---

## Muistiinpanot — mistä mikäkin löytyy

Nämä ovat mittauspöytäkirjoja, eivät johdantoja: jokainen kertoo mitä kokeiltiin,
mitä mitattiin ja miksi lopputulos on tällainen. **Lue aihetta vastaava tiedosto
ennen kuin muutat sen aluetta** — moni ilmeiseltä näyttävä parannus on jo
kokeiltu ja kaadettu mittauksella.

| tiedosto | lue kun työ koskee |
|---|---|
| `docs/lampokartta.md` | pohjakarttaa, lämpökarttaa, väriramppia, tekstuurin mitoitusta tai projektiota, kartan asetuksia |
| `docs/partikkelit.md` | tuulipartikkeleita, jäljen muotoa, tiheyttä tai ruutuaikabudjettia |
| `docs/eleet.md` | nipistystä, zoomia, zoom-aluetta, inertiaa tai kosketuskohteita |
| `docs/data.md` | säälaattoja, rajapintoja, tuulikentän rakennusta, välimuisteja, käynnistystä |
| `docs/ui.md` | paletteja, paneeleita, spottikorttia, aikajanaa, kapselia, havaintoasemia |
| `docs/pwa.md` | service workeria, offline-käynnistystä tai kotivalikon appia |

<details>
<summary>Osioiden nimet tiedostoittain (jos et tiedä mistä etsiä)</summary>

- **lampokartta**: Pohjakartta · Lämpökartta pohjakartan päällä · Lämpökartta on
  canvas, ei PNG · Väriasteikko — vain asetuspaneelissa · Lämpökartta jäi väärään
  mittakaavaan ulos zoomatessa · Kartan asetukset · Lämpökartan värit olivat eri
  kohdissa eri zoomeilla · Lämpökartta oli väärässä projektiossa · Nopea zoom ei
  saa näyttää mustaa
- **partikkelit**: Sujuvuus — mitattu, ei arvattu · Partikkelit ovat tasaisia —
  maa/vesi-rajaus kokeiltiin ja poistettiin · Rakeisuus oli kahta eri vikaa ·
  Kolme jatkokorjausta: heitto, lähizoomin terävyys, tiheys
- **eleet**: Kosketuskohteet ja pseudoelementtien osumapinta · Zoom-alue ·
  Nipistyszoomin pehmennys · Eleen loppu ja tuntuma — kolme asiaa Apple Mapsista ·
  Kaksi kokeilua jotka eivät jääneet · Yhden sormen zoom oli rikki — neljä eri
  vikaa · Uloin näkymä rajattiin — ja se muutti kaiken muun
- **data**: Verkkotila · Ensilataus — mihin aika menee · Käynnistys: välimuisti
  ruudulle ennen verkkoa · Käynnistyksen pyyntömäärä · Säädata koko maailmalle ·
  Lähdemerkintä ja aina automaattinen malli · Uloin näkymä — 44 % roskaa ·
  Oma säädatavarasto — pois rajapinnan kiintiöstä · Tallennustila ei ollutkaan
  este · Hilalähtöinen kenttä · Zoom raskaampi kuin ennen
- **ui**: Valikoiden ulkoasu — Merikartta · Mallien erimielisyys · Suosikit ja
  jaettava linkki · Puvun paksuus · Ennusteen osuvuus havaintoja vasten ·
  Spottikortin auditointi · Play ja kapseli · Aikajana kotivalikon appissa ·
  Havaintoasemien kortit · Tummat jäänteet paperipaneeleissa · Aurinkokaari

</details>

---

## Työtavat — nämä pätevät joka tehtävässä

**`npm run build`:n läpimeno ei ole todiste mistään.** Vite ei jäsennä
`index.html`:n inline-skriptiä, joten syntaksivirhe menee buildista läpi ja
kaataa vain selaimen. Tarkista skripti erikseen (`new Function(lohko)`) ja
**lataa sivu selaimessa**.

**Kun poistat lohkoja `index.html`:stä, tee se rivipohjaisesti.** Kerran lohkon
loppua etsittiin ensimmäisenä `};`-esiintymänä ja se osui moduulin *sisällä*
olevaan riviin; loppuosa jäi irrallisiksi lauseiksi ja sivu kaatui.

**Tarkista `grep -c`:llä että funktiota jota muokkaat oikeasti kutsutaan.**
`buildFmiCard` oli määritelty muttei kutsuttu koskaan — siihen kirjoitettu
ominaisuus olisi ollut hiljaa kuollut.

**Kosketuskohde on napautettava testissä.** `getBoundingClientRect` ja
`elementFromPoint` eivät kerro mihin napautus oikeasti menee; Chromiumin
kosketussäätö siirtää sen lähimpään maalattuun kohteeseen.

**Jos paikkaat Leafletin prototyyppiä, tarkista onko metodi rekisteröity
kuuntelijaksi** (`getEvents()`). Jos on, paikkauksen on oltava paikallaan ennen
`addTo(map)`:ia — Leaflet tallettaa funktioviitteen kerran.

**Dokumentaatio ja koodi ajautuvat erilleen.** Näin on käynyt kahdesti:
Syne-fontti oli kirjattu poistetuksi mutta `<head>` latasi sen yhä, ja
`State.dpr`-katoksi oli perusteltu 2 mutta rivi sanoi 3. Kun kirjoitat
mittauksen muistiin, tarkista että rivi vastaa sitä.

### Mittaaminen tässä ympäristössä

**Kontti ei kykene mittaamaan ruutunopeutta.** Se antaa 8–18 fps riippumatta
partikkelimäärästä ja CPU-kuristuksesta, eli se mittaa omaa kompositoriaan.
Ruutuaikapäätökset on varmistettava oikealla laitteella.

**Yksittäinen ajo ei kelpaa.** Sama koodi on antanut peräkkäisillä ajoilla
137,7 ms ja 280,9 ms. Toimiva asetelma:

- rinnakkaiset buildit omissa porteissaan, harness ajaa ne **vuorotellen**
- lämmitys, sitten pariton määrä kierroksia, **mediaani**
- **raakaluvut näkyviin** — jos luvut seuraavat järjestystä eivätkä asetusta,
  mittari mittaa itseään
- kontrolli toisin päin; jos se ei täsmää, tulos ei ole tulos

**`?perf=1` vie moduulit `window.FS`:ään** (`State`, `WindTexture`, `Saalaatat`,
`ViewportGrid`, `ColorRamp`, `PerfTracker`, `buildWindField`, `idw`). Ilman
kytkintä globaaliin nimiavaruuteen ei viedä mitään. Automaattinen selaintarkistus
tarvitsee tämän — moduulit ovat muuten saman skriptilohkon `const`-sidoksia.

**Mittaa totuutta vastaan, älä zoomia toista vastaan.** Kahden zoomin vertailu
sekoittaa aliotannan ja virheen eikä kerro kumpi on väärässä. Kentän tarkkuus
mitataan analyyttistä kenttää vasten.

---

## Säännöt joita ei saa rikkoa

Nämä ovat päätöksiä, eivät makuasioita. Perustelut ovat aiheen omassa
tiedostossa; tässä on vain se mitä ei saa tehdä vahingossa.

**Väri**

- **Kartalla sävy tarkoittaa tuulennopeutta ja vain sitä.** Kaikki muu kartalla
  on joko tummaa pilleriä (mitattu data) tai paperia (kaikki muu).
- **`ColorRamp.rgb()` on kartalle, `ink()` paneeleihin.** Ne kulkevat
  vastakkaisiin suuntiin kirkkaudessa. Kartan ramppi on tehty
  värisokeusturvalliseksi, muste ei ole eikä sen tarvitse olla — paneelissa väri
  on aina luvun vieressä.
- **`--accent` (magenta) on toiminto- ja varoitusväri, ei korostusväri.**
  Nimilappu tai datapiste ei ole kumpaakaan; ne ovat mustetta.
- **`var()` ei toimi SVG:n esitysattribuuteissa.** Kaavioiden `fill=` tarvitsee
  literaalin; inline-tyyleissä tokenit toimivat.

**Kenttä ja data**

- **Interpolointijärjestys: paikassa vektorit, ajassa nopeus ja suunta
  erikseen.** Suuntien aritmeettinen keskiarvo hyppää väärään suuntaan 0/360
  rajalla; vektorien interpolointi ajassa tekee vastakkaisten tuntien väliin
  keinotekoisen tyvenen. Molemmat on mitattu.
- **Kaikki aikasarjat pyydetään selaimen omassa vyöhykkeessä** (`AIKAVYOHYKE`).
  `timezone=auto` antaa jokaiselle pisteelle oman kellon ilman että
  merkkijonossa on vyöhykettä — kenttä hajoaa leveillä näkymillä.
- **Piste joka ei kata pyydettyä hetkeä jätetään pois kentästä**, ei kiinnitetä
  sarjansa päähän.
- **`/api` ei kuulu service workerin välimuistiin.** Sovelluksella on oma
  ennustevälimuisti joka osaa merkitä datan vanhaksi. Säälaatat ovat eri asia:
  ne ovat muuttumattomia ja versioituja (`?v=<ajoAika>`).

**Partikkelit**

- **Älä lisää maa/vesi-rajausta.** Kokeiltu, mitattu toimivaksi ja poistettu
  käyttäjän pyynnöstä — ero luki kartalta häiritsevänä.
- **Leveys ja määrä on viritetty yhdessä.** Jos muutat toista yksin, mustemäärä
  muuttuu eikä pyyhkäisyn tulos enää päde.
- **Älä jäädytä partikkeleita eleen ajaksi.** Toteutettu, mittarit olivat
  erinomaiset, ja se peruttiin käyttökokemuksen perusteella.

**Eleet**

- **Älä yritä neljättä derivaattapohjaista suodinta.** Lead compensation, Holt ja
  nollaviiveinen FIR kaatuivat kaikki samaan asiaan: näillä nopeuksilla
  derivaatta on lähes pelkkää vapinaa.
- **Eleen tila kulkee `nipistysAlkaa` / `nipistysPaattyy` -parin kautta**, ja
  molemmat zoom-eleet käyttävät sitä. Palautus on tehtävä jokaisella
  poistumistiellä, myös `touchcancel`issa.
