# PWA — asennettavuus ja offline

Service worker, välimuististrategiat ja kotivalikon appi.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

## PWA — kotivalikkoon ja rannalle

Vaihe 1 pushista: asennettavuus ja offline-käynnistys. Ei ilmoituksia, ei
palvelinta, ei salaisuuksia — nämä tulisivat vasta vaiheessa 2.

Tavoite on **yksi** asia: kartta ja sovellus aukeavat rannalla yhdellä
palkilla. Ei datansäästöä eikä taustapäivitystä.

### Mitä välimuistiin menee — ja mitä ei

```
/ (index.html)         verkko edellä, 3 s aikakatkaisu, varalla välimuisti
Leaflet 1.9.4 CDN      välimuisti edellä (versioitu osoite, ei voi muuttua)
karttalaatat           vanhene-ja-virkistä, katto 600, EI versioitu
säälaatat (.bin.gz)    välimuisti edellä, avain ?v=<ajoAika> (ks. alla)
säälaattojen luettelo  verkko edellä, varalla välimuisti
/api/*                 ei mitään — menee koskemattomana verkkoon
```

**Säälaatat lisättiin jälkikäteen, ja ne ovat eri asia kuin `/api`.**
`/api` on elävä kysely jonka tuoreudesta sovellus pitää itse kirjaa;
säälaatta on muuttumaton binääri. Ne olivat silti pitkään kokonaan
välimuistin ulkopuolella, koska `onLaatta()` tunnisti vain ArcGISin ja
CARTOn — kaikki muu putosi haaraan "menee koskemattomana verkkoon".
Seuraus: **kartta aukesi rannalla ilman tuulta.** Pohjakartta oli
levyllä, tuulikenttä ei.

- **Avaimessa on ajon tunnus** (`?v=<ajoAika>`), ja se on pakollinen.
  Sama osoite palauttaa eri sisällön kuuden tunnin välein, joten ilman
  versiota välimuistista voisi tulla eri ajon laatta tuoreen
  aika-akselin kanssa — eli hiljaa väärä aika. Versioidulla osoitteella
  sisältö ei voi muuttua ja välimuisti edellä on turvallista.
- **Vain yksi sukupolvi kerrallaan.** Uusi versio luo uuden
  välimuistin (`saa-<ajoAika>`) ja vanhat poistetaan. Ilman sitä varasto
  kasvaisi noin 30 MB:n kerroksella joka ajolla.
- **GitHubin oma `cache-control` on `max-age=300`** — viisi minuuttia
  datalle joka vaihtuu kuuden tunnin välein. Selaimen välimuisti ei siis
  auta käytännössä lainkaan; service worker on ainoa joka pitää laatat.
- **Luettelo on verkko edellä.** Se on ainoa joka kertoo onko varasto
  tuore, joten sitä ei saa tarjoilla vanhana silloin kun verkko toimii —
  mutta ilman varakopiota koko varasto putoaa pois heti kun yhteyttä ei
  ole, ja juuri silloin siitä on eniten hyötyä.

Mitattu preview-buildilla, api estettynä:

```
1. lataus   4 laattaa verkosta (sw ei vielä hallitse sivua)
2. lataus   4 laattaa verkosta, välimuistit syntyvät
3. lataus   0 laattaa verkosta
offline     kartta latautuu, lämpökartta 224x491, 0 % läpinäkyviä
            pikseleitä, aikajana 99 tikkiä, lähdemerkintä oikein
```

**`/api` on tarkoituksella ulkopuolella.** Sovelluksella on jo oma
ennustevälimuisti localStoragessa ja se osaa merkitä datan vanhentuneeksi.
Toinen välimuisti sen alla tarjoaisi vanhaa dataa tuoreena eikä sovellus
tietäisi siitä mitään.

**Navigointi on verkko edellä, ei välimuisti edellä.** Sovellus on yksi
`index.html` ilman hajautettuja tiedostonimiä, joten välimuisti edellä
jäädyttäisi koko sovelluksen vanhaan versioon eikä siitä näkyisi mitään
ulospäin — sama ongelma jota vastaan versioleima aikanaan tehtiin. Mutta
"yksi palkki" ei ole sama kuin "ei verkkoa", joten pelkkä verkko edellä
jättäisi käynnistyksen roikkumaan hitaan haun taakse. Siksi 3 s aikakatkaisu:
sen jälkeen näytetään välimuisti ja haku jatkuu taustalla.

**Laattavälimuistia ei versioida.** Sen koko arvo on että eilen katsotut
laatat ovat tallessa tänään. Jos se tyhjenisi joka deployssa, rannalla ei
olisi mitään. Kuorivälimuisti sen sijaan versioidaan ja vanha siivotaan
`activate`ssa.

**Laatat ovat vanhene-ja-virkistä eivätkä välimuisti edellä.** Ne ovat
`<img>`-hakuja ilman CORSia, joten vastaus on läpinäkymätön eikä sen
onnistumista voi tarkistaa. Välimuisti edellä jättäisi yhden epäonnistuneen
laatan pysyvästi ruudulle; virkistys korjaa sellaisen seuraavalla käynnillä
ja välimuistista tarjoillaan silti heti.

### Kaksi asiaa jotka pitää muistaa

**Leima menee myös `sw.js`:ään.** Service worker päivittyy vain jos sen
**tavut** muuttuvat — ilman leimaa uusi deploy jättäisi vanhan workerin ja sen
mukana vanhan kuorivälimuistin voimaan. `public/` kopioidaan sellaisenaan,
joten korvaus tehdään `versioLeima`-pluginin `writeBundle`-vaiheessa.

**Devissä worker on tyhjäkäynnillä.** `public/sw.js`:ssä leima on korvaamatta,
ja `DEV`-lippu katkaisee sekä `install`in että `fetch`in. Muuten Viten HMR ja
oma välimuisti sotkeutuisivat keskenään.

### Mitattu

Preview-buildilla, oikealla verkolla:

```
rekisteröinti      scope /, aktivoituu ja ottaa sivun hallintaansa
manifest           standalone, kolme ikonia 200, apple-touch-icon 200
välimuistit        kuori 3 merkintää, laatat 32
/api               ei yhtään merkintää
OFFLINE + reload   sivu latautuu, Leaflet latautuu, kartta rakentuu,
                   28 laattaa ruudulla, /api epäonnistuu (ei valehtele)
deploy (uusi leima) vanha kuori siivottu, uusi luotu, laatat säilyivät,
                   worker aktivoitui ja hallitsee
```

### Testaamisen sudenkuoppa

Chromium ei pääse agenttiproxyn läpi jsdelivriin (`ERR_CONNECTION_RESET`)
vaikka `curl` pääsee. Leaflet on siis tyngättävä testissä — ja tyngät on
asennettava **`context.route`en eikä `page.route`en**, koska service workerin
omat haut eivät kulje sivun reittien kautta.

### Löydös jota ei korjattu

`<head>`issä ladataan yhä Google Fontsista **Syne ja DM Mono**, vaikka
CLAUDE.md:ssä lukee että ne poistettiin. Ne ovat oikeasti yhä käytössä
seitsemässä `font-family`-säännössä, eli lataukset eivät ole pelkkää roskaa —
poisto muuttaisi ulkoasua. Mutta ne ovat kaksi ulkoista pyyntöä joka
latauksella, ja juuri ne ovat kalleimpia heikolla yhteydellä. Tämä on oma
päätöksensä, ei osa PWA-vaihetta.
