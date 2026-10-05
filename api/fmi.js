import { suojaa } from './_suoja.js';
import { haeFmi } from './_haku.js';
import { rakennaLaatta, rakennaSarja, asemaluettelo, kelpoTunnus, LAATTA_X, LAATTA_Y } from './_esoh.js';

/* ASEMAREKISTERI (docs/oikeellisuus.md, O6). Sama lista kuin index.html:n
 * `FMI_MAP_STATIONS` — ÄLÄ LISÄÄ ASEMAA VAIN TOISEEN (CLAUDE.md).
 *
 * KAIKKI HAETAAN FMISID:LLÄ. Kuusi asemaa haettiin ennen nimellä
 * (`place=malmi`), ja nimi on FMI:n paikannimihaku eikä asematunnus:
 * `place=malmi` palautti mitattuna `numberMatched="0"` myös silloin kun
 * FMISID 101009 lähetti. Koordinaatit ovat FMI:n omasta vastauksesta
 * (Tapiola oli 1,1 km ja Helsinki-Vantaa 1,5 km sivussa).
 *
 * Malmi (lähetti viimeksi 25.9.2026) ja Vuosaaren satama (18.8.2026)
 * ovat mukana: tyhjä ikkuna poistaa merkin kartalta ja se palaa
 * itsestään kun asema jatkaa lähettämistä ("KATKO JA LAKKAUTUS").
 *
 * Avomeriasemat Kalbådagrundista Rajakariin lisättiin 29.9.: yksi
 * etelärannikon kysely palautti 28 tuuliasemaa, ja rekisterissä oli 12. */
export const STATIONS = [
  { place: 'kaisaniemi',   name: 'Helsinki Kaisaniemi',      lat: 60.17523, lng: 24.94459, fmisid: '100971' },
  { place: 'kumpula',      name: 'Helsinki Kumpula',         lat: 60.20307, lng: 24.96131, fmisid: '101004' },
  { place: 'harmaja',      name: 'Helsinki Harmaja',         lat: 60.10512, lng: 24.97539, fmisid: '100996' },
  { place: 'tapiola',      name: 'Espoo Tapiola',            lat: 60.17797, lng: 24.78743, fmisid: '874863' },
  { place: 'malmi',        name: 'Helsinki Malmi',           lat: 60.25299, lng: 25.04549, fmisid: '101009' },
  { place: 'vantaa',       name: 'Vantaa Helsinki-Vantaa',   lat: 60.32937, lng: 24.97274, fmisid: '100968' },
  { place: 'vuosaari',     name: 'Helsinki Vuosaari satama', lat: 60.20867, lng: 25.19590, fmisid: '151028' },
  { place: 'sipoo',        name: 'Sipoo Itätoukki',          lat: 60.10121, lng: 25.19439, fmisid: '105392' },
  { place: 'emasalo',      name: 'Porvoo Emäsalo',           lat: 60.20382, lng: 25.62546, fmisid: '101023' },
  { place: 'kilpilahti',   name: 'Porvoo Kilpilahti satama', lat: 60.30373, lng: 25.54916, fmisid: '100683' },
  { place: 'kalbadagrund', name: 'Porvoo Kalbådagrund',      lat: 59.98568, lng: 25.59879, fmisid: '101022' },
  { place: 'orrengrund',   name: 'Loviisa Orrengrund',       lat: 60.27476, lng: 26.44759, fmisid: '101039' },
  { place: 'rankki',       name: 'Kotka Rankki',             lat: 60.37538, lng: 26.95893, fmisid: '101030' },
  { place: 'haapasaari',   name: 'Kotka Haapasaari',         lat: 60.28676, lng: 27.18482, fmisid: '101042' },
  /* Kirkkonummi Mäkiluoto on se asema jota "Porkkala"-sääpalvelut
     käyttävät; FMI:llä ei ole asemaa nimellä Porkkala. */
  { place: 'porkkala',     name: 'Kirkkonummi Mäkiluoto',    lat: 59.91982, lng: 24.35023, fmisid: '100997' },
  { place: 'bagaskar',     name: 'Inkoo Bågaskär',           lat: 59.93114, lng: 24.01408, fmisid: '100969' },
  { place: 'hanko',        name: 'Hanko Tulliniemi',         lat: 59.80864, lng: 22.91246, fmisid: '100946' },
  { place: 'russaro',      name: 'Hanko Russarö',            lat: 59.77363, lng: 22.94868, fmisid: '100932' },
  { place: 'vano',         name: 'Kemiönsaari Vänö',         lat: 59.86949, lng: 22.19343, fmisid: '100945' },
  { place: 'fagerholm',    name: 'Parainen Fagerholm',       lat: 60.11163, lng: 21.69828, fmisid: '100924' },
  { place: 'rajakari',     name: 'Turku Rajakari',           lat: 60.37788, lng: 22.09640, fmisid: '100947' },
];

/* Rekisterin asemat E-SOH:n tunnuksina (FMI julkaisee FMISID:n
   paikallisena osana: 0-246-0-<fmisid>). Ne tulevat tämän proxyn
   FMI-haaroista 7 vrk:n historialla, joten Euroopan laatta jättää ne
   pois — muuten sama asema olisi kartalla kahtena merkkinä. */
const REKISTERISSA = new Set(STATIONS.map(function (s) { return '0-246-0-' + s.fmisid; }));

function km(a,b,c,d){var R=6371,dL=(c-a)*Math.PI/180,dG=(d-b)*Math.PI/180;return R*2*Math.asin(Math.sqrt(Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2));}
function nearest(lat,lng){return STATIONS.slice().sort(function(a,b){return km(lat,lng,a.lat,a.lng)-km(lat,lng,b.lat,b.lng);})[0];}

/* Virhe on virhe (docs/oikeellisuus.md, O5): `haeFmi` heittää kun FMI
   vastaa muulla kuin 200:lla tai ExceptionReportilla, ja käsittelijä
   vastaa silloin 502:lla. Ennen virherunko jäsennettiin tyhjäksi ja
   vastaus oli `{error:'no data'}` HTTP 200:lla — sovellus lukee sen
   lakkautukseksi ja poisti aseman kartalta. */
function fetchUrl(url){ return haeFmi(url); }

const WFS = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature';
const MP = WFS + '&storedquery_id=fmi::observations::weather::multipointcoverage';
const DT_MS = 600000;

/* Kehitystyökalujen jäsennin (timevaluepair). Varsinaiset haut ovat
   multipointcoverageja, ks. alla. */
function parseHistory(xml){
  var series={};
  var re=/gml:id="[^"]*-([a-zA-Z]+)"[\s\S]*?(<wml2:point[\s\S]*?<\/wml2:MeasurementTimeseries>)/g;
  var m;
  while((m=re.exec(xml))!==null){
    var param=m[1].toLowerCase(),block=m[2],points=[];
    var tvRe=/<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]+)<\/wml2:value>/g,tv;
    while((tv=tvRe.exec(block))!==null){var v=parseFloat(tv[2]);if(!isNaN(v))points.push({t:tv[1],v:v});}
    series[param]=points;
  }
  return series;
}

function makeBbox(lat,lng,d){return(lng-d).toFixed(4)+','+(lat-d).toFixed(4)+','+(lng+d).toFixed(4)+','+(lat+d).toFixed(4);}

/* Kaikki haut ovat multipointcoverageja, ei timevaluepaireja.
 *
 * Sama sisalto, murto-osa tavuista: mitattuna 7 vrk / 10 min / 3 parametria
 * on timevaluepairina 993 kt ja multipointcoveragena 84 kt — kaksitoista-
 * kertainen ero. Syy on formaatti: timevaluepair kirjoittaa jokaisen arvon
 * omaan <wml2:point><wml2:MeasurementTVP><wml2:time>-rakenteeseensa, kun
 * multipointcoverage on kaksi tekstiblokkia: aikaleimat ja luvut riveittain.
 *
 * Formaatti:
 *   <swe:field name="WindSpeedMS"/> ...   kertoo sarakejarjestyksen
 *   <gml:Point gml:id="point-FMISID"> ... <gml:pos>lat lng</gml:pos>
 *   <gmlcov:positions>  "lat lng epoch"   rivi per hetki
 *   <gml:doubleOrNilReasonTupleList>      "6.6 7.6 311.0" rivi per hetki
 * Puuttuva arvo on NaN.
 *
 * RIVI KERTOO ASEMAN SIJAINNILLAAN, ja sijainti sidotaan FMISID:hen
 * pisteluettelosta. Usean aseman kyselyssä asemat tulevat tunnuksen
 * järjestyksessä eikä pyynnön, ja tyhjä asema puuttuu kokonaan —
 * järjestykseen luottava jäsennys antaisi aseman datan toiselle. */
function parseMultipoint(xml){
  var fields=[],fm,fre=/<swe:field\s+name="([^"]+)"/g;
  while((fm=fre.exec(xml))!==null)fields.push(fm[1]);
  var pm=/<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/.exec(xml);
  var vm=/<gml:doubleOrNilReasonTupleList>([\s\S]*?)<\/gml:doubleOrNilReasonTupleList>/.exec(xml);
  if(!fields.length||!pm||!vm)return null;
  var paikat={},pp,pre=/<gml:Point\s+gml:id="point-(\d+)"[\s\S]*?<gml:pos>([^<]+)<\/gml:pos>/g;
  while((pp=pre.exec(xml))!==null){
    var pc0=pp[2].trim().split(/\s+/);
    paikat[(+pc0[0]).toFixed(5)+' '+(+pc0[1]).toFixed(5)]=pp[1];
  }
  var pl=pm[1].trim().split('\n'),vl=vm[1].trim().split('\n');
  var rows=[];
  for(var i=0;i<pl.length&&i<vl.length;i++){
    var pc=pl[i].trim().split(/\s+/);
    if(pc.length<3)continue;
    var sec=parseInt(pc[2],10);
    if(isNaN(sec))continue;
    var vc=vl[i].trim().split(/\s+/).map(parseFloat);
    rows.push({ms:sec*1000,v:vc,fmisid:paikat[(+pc[0]).toFixed(5)+' '+(+pc[1]).toFixed(5)]||null});
  }
  return {fields:fields,rows:rows};
}

/* HH:MM pyydetyssa aikavyohykkeessa. Kasin kirjoitettu kesaaikasaanto
   korvattiin Intl:lla samasta syysta kuin api/harmonie.js:ssa: se osaa
   myos muut vyohykkeet kuin Suomen eika mene kesaajan vaihtumisviikolla
   sekaisin. Formatteri on kallis rakentaa, joten se muistetaan. */
var _tzFmt = {};
function hhmm(ms,tz){
  if(!_tzFmt[tz]){
    try{ _tzFmt[tz]=new Intl.DateTimeFormat('sv-SE',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}); }
    catch(e){ _tzFmt[tz]=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki',hour:'2-digit',minute:'2-digit',hour12:false}); }
  }
  return _tzFmt[tz].format(new Date(ms));
}
function kelpoTz(tz){
  if(!tz)return null;
  try{ new Intl.DateTimeFormat('sv-SE',{timeZone:tz}); return tz; }catch(e){ return null; }
}

function isoMin(ms){ return new Date(ms).toISOString().slice(0,16)+'Z'; }
function arvo(r,i){ var v=i>=0?r.v[i]:NaN; return v!=null&&!isNaN(v)?v:null; }

function mpUrl(fmisids,params,startMs){
  return MP+'&parameters='+params+'&timestep=10&starttime='+isoMin(startMs)
    +fmisids.map(function(id){return '&fmisid='+id;}).join('');
}

export default async function handler(req,res){
  if (!suojaa(req, res)) return;
  /* KEHITYSTYÖKALUT VAIN KEHITYKSESSÄ (docs/julkaisu.md, L10). Nämä kolme
     haaraa (findstation, stationcoord, debug) tekivät kymmeniä
     FMI-kutsuja pyyntöä kohti, ja stationcoord liitti `fmisid`in
     sellaisenaan FMI:n osoitteeseen ja palautti vastauksen raakana.
     Tuotannossa ne ovat kiinni; paikallisesti FS_DEBUG=1 avaa ne. */
  var kehitys = process.env.FS_DEBUG === '1';
  if(!kehitys && (req.query.findstation==='1' || req.query.stationcoord==='1' || req.query.debug==='1')){
    return res.status(404).json({error:'not found'});
  }
  if(kehitys && (req.query.findstation==='1' || req.query.stationcoord==='1' || req.query.debug==='1')){
    return kehitysHaarat(req,res);
  }

  var tz=kelpoTz(req.query.tz)||'Europe/Helsinki';

  /* EUROOPAN HAVAINNOT (docs/eurooppa.md, luku 14): MeteoGate E-SOH
     tilana tässä funktiossa eikä omana tiedostonaan (12 funktion katto). */
  if(req.query.eu) return euHaara(req,res,tz);

  /* KAIKKI ASEMAT YHDELLÄ KYSELYLLÄ (docs/oikeellisuus.md, O6).
     Karttamerkit tekivät ennen kaksi pyyntöä asemaa kohti (tuorein +
     historia) eli 24 käynnistyksessä, jokainen omalla osoitteellaan.
     Nyt yksi FMI-kysely ja yksi osoite kaikille käyttäjille, joten CDN
     jakaa sen. */
  if(req.query.asemat==='1'){
    try{
      /* 48 h 21 asemalle on mitattuna 2,9 s ja 250 kt FMI:ltä: oletusraja
         8 s jättäisi ruuhkassa liian vähän varaa (funktion katto 30 s). */
      var tulos=await kaikkiAsemat(Math.max(1,Math.min(48,parseInt(req.query.hours,10)||24)),15000);
      if(!tulos){
        /* Yksikään asema ei vastannut: se on FMI:n tai kyselyn vika eikä
           kaikkien asemien lakkautus. Tyhjä vastaus poistaisi koko
           havaintokerroksen kartalta. */
        res.setHeader('Cache-Control','no-store');
        return res.status(502).json({error:'ei yhtään asemaa'});
      }
      res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=60');
      return res.status(200).json(tulos);
    }catch(err){
      res.setHeader('Cache-Control','no-store');
      return res.status(502).json({error:err.message});
    }
  }

  var lat=parseFloat(req.query.lat),lng=parseFloat(req.query.lng);
  var placeParam=req.query.place;
  var station;
  if(placeParam){
    station=STATIONS.find(function(s){return s.place===placeParam;});
    if(!station&&!isNaN(lat)&&!isNaN(lng))station=nearest(lat,lng);
    if(!station)station=STATIONS[0];
  }else if(!isNaN(lat)&&!isNaN(lng)){
    station=nearest(lat,lng);
  }else{
    station=STATIONS[0];
  }

  var isHistory=req.query.history==='1';
  /* FMI:n yksiselitteinen katto on 7 vrk: mitattuna 168 h menee lapi ja
     192 h vastaa "Too long time interval requested!". Alaraja 1 h. */
  var hours=Math.max(1,Math.min(168,parseInt(req.query.hours,10)||24));
  var startMs=isHistory?Date.now()-hours*3600000:Date.now()-60*60000;

  try{
    /* Historiassa on myos suunta ja lampotila. Ne olivat aina FMI:lla
       saatavilla samalla 10 min tiheydella — niita ei vain pyydetty, joten
       graafi ei voinut nayttaa suuntaa lainkaan ja tooltipin nuoli oli
       kuollutta koodia (p.d oli aina null). */
    if(isHistory){
      var histXml=await fetchUrl(mpUrl([station.fmisid],'WindSpeedMS,WindGust,WindDirection,Temperature',startMs));
      res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=120');
      return res.status(200).json(buildHistory(histXml,station,tz));
    }
    var xml=await fetchUrl(mpUrl([station.fmisid],'WindSpeedMS,WindDirection,WindGust,Temperature,DewPoint',startMs));
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(buildLatest(xml,station,tz));
  }catch(err){
    /* Ylävirran virhe ei ole "ei dataa": 502 ja ei välimuistiin, jotta
       asiakas näyttää katkon eikä lakkautusta, eikä CDN jaa virhettä
       kaikille viideksi minuutiksi. */
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:err.message});
  }
};

/* TUOREIN HAVAINTO ON YKSI RIVI. Timevaluepair-jäsennin otti jokaisen
   suureen tuoreimman erikseen, jolloin suunta ja puuska saattoivat olla
   eri kymmenminuuttiselta kuin tuuli (asema lähettää puuskan ja suunnan
   joskus myöhässä tai ei lainkaan). Nyt tuuli, suunta ja puuska ovat
   samalta riviltä; lämpötila ja kastepiste tuoreimmat, koska ne eivät
   ole tuulen kanssa samaa lukemaa. */
function buildLatest(xml,station,tz){
  var mp=xml?parseMultipoint(xml):null;
  var tyhja={error:'no data',station:station.name,place:station.place};
  if(!mp||!mp.rows.length)return tyhja;
  var f=mp.fields;
  var iWs=f.indexOf('WindSpeedMS'),iWd=f.indexOf('WindDirection'),iWg=f.indexOf('WindGust');
  var iTa=f.indexOf('Temperature'),iDp=f.indexOf('DewPoint');
  var rivi=null,ta=null,dp=null;
  for(var i=0;i<mp.rows.length;i++){
    var r=mp.rows[i];
    if(arvo(r,iWs)!=null)rivi=r;
    if(arvo(r,iTa)!=null)ta=arvo(r,iTa);
    if(arvo(r,iDp)!=null)dp=arvo(r,iDp);
  }
  if(!rivi)return tyhja;
  return {
    station:station.name,place:station.place,
    ws:arvo(rivi,iWs),wd:arvo(rivi,iWd),wg:arvo(rivi,iWg),
    tmp:ta,dew:dp,
    time:hhmm(rivi.ms,tz),
    /* Havainnon hetki. Ika lasketaan asiakkaassa tasta (O7): `ageMin`
       jaatyy hakuhetkeen ja CDN:n valimuisti vanhentaa sita. */
    lastIso:new Date(rivi.ms).toISOString(),
    ageMin:Math.round((Date.now()-rivi.ms)/60000),
  };
}

function buildHistory(xml,station,tz){
  var tyhja={error:'no data',station:station.name,place:station.place,ws:[],wg:[],ta:[]};
  var mp=xml?parseMultipoint(xml):null;
  if(!mp||!mp.rows.length)return tyhja;
  var iWs=mp.fields.indexOf('WindSpeedMS'),iWg=mp.fields.indexOf('WindGust');
  var iWd=mp.fields.indexOf('WindDirection'),iTa=mp.fields.indexOf('Temperature');
  if(iWs<0)return tyhja;
  var ws=[],wg=[],ta=[],viimeMs=null;
  for(var i=0;i<mp.rows.length;i++){
    var r=mp.rows[i],v=r.v[iWs];
    /* iso = yksiselitteinen aikaleima. "t" (HH:MM) on pelkkaa nayttoa
       varten — se ei riita yksin kun historia kattaa yli vuorokauden,
       koska sama kellonaika esiintyy silloin useasti. */
    var iso=new Date(r.ms).toISOString();
    if(v!=null&&!isNaN(v)){
      ws.push({t:hhmm(r.ms,tz),v:v,d:(iWd>=0&&!isNaN(r.v[iWd]))?r.v[iWd]:null,iso:iso});
      viimeMs=r.ms;
      if(iWg>=0&&!isNaN(r.v[iWg]))wg.push({t:hhmm(r.ms,tz),v:r.v[iWg],iso:iso});
    }
    if(iTa>=0&&!isNaN(r.v[iTa]))ta.push({t:hhmm(r.ms,tz),v:r.v[iTa],iso:iso});
  }
  if(!ws.length)return tyhja;
  return {
    station:station.name,place:station.place,
    lat:station.lat,lng:station.lng,
    ws:ws,wg:wg,ta:ta,
    lastIso:new Date(viimeMs).toISOString(),
    ageMin:Math.round((Date.now()-viimeMs)/60000),
  };
}

/* `?asemat=1&hours=N` (1–48 h). Vastaus on tiivis: yhteinen 10 min
 * aika-akseli ja asemittain samanpituiset taulukot.
 *
 *   { t0, dt: 600000, n, asemat: { harmaja: { ws:[…], wg:[…], wd:[…] },
 *                                  malmi: null, … } }
 *
 * `null` = asema on rekisterissä mutta FMI ei palauttanut siltä yhtään
 * riviä koko ikkunasta (sama merkitys kuin yhden aseman `no data`).
 * Puuttuva lukema on `null` taulukossa. Tuorein havainto on taulukon
 * viimeinen ei-null tuuli — samalta riviltä suunta ja puuska.
 *
 * Tiiviys on mitattu: 21 asemaa × 48 h oliomuodossa (`{t,v,d,iso}`)
 * olisi satoja kilotavuja, tässä muodossa kymmeniä. Lämpötilaa ei
 * haeta, koska karttamerkki ei näytä sitä (kortti hakee oman sarjansa). */
/* Viety myös tools/varmennus.mjs:lle (O11): sama kysely, sama jäsennys ja
   sama rekisteri kuin sovelluksella — varmennus ei saa lukea havaintoja
   eri tavalla kuin kartta ne näyttää. Palvelimen reitti rajaa tunnit
   1–48:aan; työkalu pyytää pidemmän jakson suoraan. */
export async function kaikkiAsemat(hours,aikaraja){
  var t0=Math.floor((Date.now()-hours*3600000)/DT_MS)*DT_MS;
  var xml=await haeFmi(mpUrl(STATIONS.map(function(s){return s.fmisid;}),'WindSpeedMS,WindGust,WindDirection',t0),
    aikaraja?{aikaraja:aikaraja}:undefined);
  var mp=parseMultipoint(xml);
  if(!mp||!mp.rows.length)return null;
  var iWs=mp.fields.indexOf('WindSpeedMS'),iWg=mp.fields.indexOf('WindGust'),iWd=mp.fields.indexOf('WindDirection');
  if(iWs<0)return null;
  var loppu=t0;
  for(var i=0;i<mp.rows.length;i++)if(mp.rows[i].ms>loppu)loppu=mp.rows[i].ms;
  var n=Math.round((loppu-t0)/DT_MS)+1;
  var sarjat={};
  for(var j=0;j<mp.rows.length;j++){
    var r=mp.rows[j];
    if(!r.fmisid)continue;
    var k=Math.round((r.ms-t0)/DT_MS);
    if(k<0||k>=n)continue;
    var s=sarjat[r.fmisid];
    if(!s){
      s=sarjat[r.fmisid]={ws:new Array(n).fill(null),wg:new Array(n).fill(null),wd:new Array(n).fill(null),ok:false};
    }
    var w=arvo(r,iWs);
    if(w!=null){ s.ws[k]=w; s.ok=true; }
    s.wg[k]=arvo(r,iWg);
    s.wd[k]=arvo(r,iWd);
  }
  var asemat={},yksikin=false;
  STATIONS.forEach(function(st){
    var s=sarjat[st.fmisid];
    if(s&&s.ok){ asemat[st.place]={ws:s.ws,wg:s.wg,wd:s.wd}; yksikin=true; }
    else asemat[st.place]=null;
  });
  if(!yksikin)return null;
  return {t0:t0,dt:DT_MS,n:n,asemat:asemat};
}

/* ── Eurooppa: MeteoGate E-SOH (api/_esoh.js) ───────────────────
 *
 *   ?eu=laatta&x=<0..89>&y=<0..44>   kartan laatta 4° × 4°: asemat,
 *                                    48 h tunnin näytteet, tuorein lukema
 *   ?eu=sarja&id=<WIGOS>&lat&lng&hours=<1..168>
 *                                    asemakortin sarja (FMI:n historian
 *                                    muodossa), 24 h täydellä tarkkuudella
 *
 * Sama virhesopimus kuin FMI-haaroilla (O5): ylävirran virhe on 502 ja
 * `no-store`, eikä sitä tarjoilla tyhjänä — tyhjä vastaus poistaisi
 * merkit kartalta. Tyhjä laatta (avomeri) on 200 ja CDN:ssä 15 min. */
async function euHaara(req,res,tz){
  var tila=req.query.eu;
  if(tila==='laatta'){
    var x=parseInt(req.query.x,10),y=parseInt(req.query.y,10);
    if(!(x>=0&&x<LAATTA_X&&y>=0&&y<LAATTA_Y)){
      res.setHeader('Cache-Control','no-store');
      return res.status(400).json({error:'laatta'});
    }
    try{
      var l=await rakennaLaatta(x,y,REKISTERISSA);
      res.setHeader('Cache-Control',l.asemat.length?'public, s-maxage=300, stale-while-revalidate=600':'public, s-maxage=900');
      return res.status(200).json(l);
    }catch(err){
      res.setHeader('Cache-Control','no-store');
      return res.status(502).json({error:err.message});
    }
  }
  /* KAUKOPISTEET: koko Euroopan asemat yhtenä vastauksena (keräimen
     luettelo, docs/eurooppa.md luku 15). Sama osoite kaikille, joten CDN
     palvelee sen; luettelo muuttuu kerran päivässä. */
  if(tila==='asemat'){
    try{
      var lu=await asemaluettelo(REKISTERISSA);
      res.setHeader('Cache-Control',lu.asemat.length?'public, s-maxage=1800, stale-while-revalidate=86400':'public, s-maxage=300');
      return res.status(200).json(lu);
    }catch(err){
      res.setHeader('Cache-Control','no-store');
      return res.status(502).json({error:err.message});
    }
  }
  if(tila==='sarja'){
    var id=String(req.query.id||''),lat=parseFloat(req.query.lat),lng=parseFloat(req.query.lng);
    if(!kelpoTunnus(id)||!isFinite(lat)||!isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
      res.setHeader('Cache-Control','no-store');
      return res.status(400).json({error:'asema'});
    }
    var tunnit=Math.max(1,Math.min(168,parseInt(req.query.hours,10)||24));
    try{
      var s=await rakennaSarja(id,lat,lng,tunnit,tz);
      res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=120');
      return res.status(200).json(s);
    }catch(err){
      res.setHeader('Cache-Control','no-store');
      return res.status(502).json({error:err.message});
    }
  }
  res.setHeader('Cache-Control','no-store');
  return res.status(400).json({error:'tila'});
}

/* ── Kehitystyökalut (FS_DEBUG=1) ─────────────────────────────── */
async function kehitysHaarat(req,res){
  /* FINDSTATION: testaa FMISID:t oikealla datalla */
  if(req.query.findstation==='1'){
    var target_ws=parseFloat(req.query.ws||'4.1');
    var target_date=req.query.date||'2026-04-18';
    var startT=target_date+'T07:00:00Z', endT=target_date+'T08:30:00Z';
    var BASE2=WFS+'&storedquery_id=fmi::observations::weather::timevaluepair'
      +'&parameters=WindSpeedMS,WindGust&timestep=10&starttime='+startT+'&endtime='+endT;
    function toFi2(iso){return hhmm(Date.parse(iso),'Europe/Helsinki');}
    var testIds=['151028','151048','100928','101023','105392','100540'];
    var results={date:target_date,target_ws:target_ws,fmisids:{}};
    for(var ii=0;ii<testIds.length;ii++){
      var fid=testIds[ii];
      try{
        var xf=await fetchUrl(BASE2+'&fmisid='+fid);
        var sf=parseHistory(xf);
        var wsArr=(sf.windspeedms||[]).map(function(p){return{t:toFi2(p.t),v:p.v};});
        var wgArr=(sf.windgust||[]).map(function(p){return{t:toFi2(p.t),v:p.v};});
        var ws10=wsArr.find(function(p){return p.t==='10:00';});
        var wg10=wgArr.find(function(p){return p.t==='10:00';});
        results.fmisids[fid]={ws_at_10:ws10?ws10.v:null,wg_at_10:wg10?wg10.v:null,n:wsArr.length,match:ws10&&Math.abs(ws10.v-target_ws)<0.5};
      }catch(e){results.fmisids[fid]={error:e.message};}
    }
    return res.status(200).json(results);
  }

  /* STATIONCOORD: hae aseman koordinaatit FMISID:llä */
  if(req.query.stationcoord==='1'){
    var fid2=/^\d{4,7}$/.test(req.query.fmisid||'')?req.query.fmisid:'105392';
    var url=WFS+'&storedquery_id=fmi::observations::weather::timevaluepair'
      +'&fmisid='+fid2+'&parameters=WindSpeedMS&timestep=60&starttime='+isoMin(Date.now()-2*3600000);
    try{
      var xml=await fetchUrl(url);
      var pos=xml.match(/gml:pos[^>]*>([^<]+)/);
      var name=xml.match(/gmd:name>([^<]+)/);
      var fmisidMatch=xml.match(/fmisid[^>]*>(\d+)/);
      return res.status(200).json({
        fmisid:fid2, name:name?name[1]:null, pos:pos?pos[1]:null,
        fmisid_found:fmisidMatch?fmisidMatch[1]:null, xml_snippet:xml.slice(0,800)
      });
    }catch(e){return res.status(500).json({error:e.message});}
  }

  /* DEBUG: listaa kaikki asemat alueelta */
  var dlat=parseFloat(req.query.lat)||60.158, dlng=parseFloat(req.query.lng)||25.326;
  var dd=parseFloat(req.query.d)||0.20;
  var bb=makeBbox(dlat,dlng,dd);
  var start=isoMin(Date.now()-2*3600000);
  var out={bbox:bb,lat:dlat,lng:dlng,strategies:{}};
  try{
    var x1=await fetchUrl(WFS+'&storedquery_id=fmi::observations::weather::timevaluepair&bbox='+bb
      +'&parameters=WindSpeedMS&timestep=60&starttime='+start+'&maxlocations=5');
    var ids1=[...x1.matchAll(/gml:id="([^"]+)"/g)].map(function(m){return m[1];}).filter(function(id){return id.includes('obs');});
    out.strategies.weather_bbox={ids:ids1,len:x1.length,hasData:x1.includes('wml2:value')};
  }catch(e){out.strategies.weather_bbox={error:e.message};}
  try{
    var x2=await fetchUrl(WFS+'&storedquery_id=fmi::observations::maritime::simple&bbox='+bb
      +'&parameters=WindSpeedMS&timestep=60&starttime='+start+'&maxlocations=5');
    var ids2=[...x2.matchAll(/gml:id="([^"]+)"/g)].map(function(m){return m[1];}).filter(function(id){return id.includes('obs');});
    out.strategies.maritime_bbox={ids:ids2,len:x2.length,hasData:x2.includes('wml2:value')};
  }catch(e){out.strategies.maritime_bbox={error:e.message};}
  return res.status(200).json(out);
}
