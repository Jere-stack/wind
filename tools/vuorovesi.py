#!/usr/bin/env python3
"""VUOROVESIVAKIOT EOT20:STÄ SOVELLUKSELLE (docs/aallot.md V6–V7).

Ajetaan käsin, kun malli tai muoto vaihtuu (kuten `tools/maat.mjs`); tulos
on repossa valmiina (`public/vuorovesi/`), joten build ei tarvitse tätä.

    pip install numpy h5py
    python3 tools/vuorovesi.py <EOT20:n zip tai ocean_tides-hakemisto> [public/vuorovesi]

Lähde: DGFI-TUM EOT20 (Hart-Davis ym. 2021, SEANOE 10.17882/79489, CC BY
4.0), 17 osavuorovettä 0,125°:n hilassa; 66° S – 66° N altimetriasta ja
napa-alueet FES2014b:stä. Käytetään kahdeksaa pääosavuorovettä (M2, S2,
N2, K2, K1, O1, P1, Q1): M4 ei muuttanut NOAA:n kahdeksan aseman
ennustetta vasten mitattuna (15.10.) yhtään senttiä.

MUOTO: vakio on kompleksiluku Re = A·cos G, Im = A·sin G (G Greenwichin
vaihe), jolloin korkeus on h(t) = Σ f·(Re·cos(V + u) + Im·sin(V + u)) ja
väli interpoloituu oikein myös amfidromisen pisteen lähellä (amplitudin
ja vaiheen erillinen interpolointi ei). Laatta on 41 × 41 solmua
(`FSVV`): otsake 56 tavua (tunniste, versio, osien määrä, askel, kulma,
koko ja osakohtainen skaala), sitten int8-tasot [osa][Re, Im][y][x]
skaalattuna laatan suurimpaan arvoon (Brestissä M2:n askel 1,5 cm,
Välimerellä millejä) ja maski [y][x]: 0 maa, 1 meri, 2 meri jossa
malli on tunnettua asemaa vasten epäluotettava, 3 suljettu vesi (padottu
järvi tai kanava, `SULJETUT`): ei vuorovettä, eikä kartan "Vuorovesi"-
näkymä (V7) jatka rannan kenttää sinne.

TASOT: t0 0,125° (mallin oma hila) vain laatoille joissa on rantaa,
t1 0,5° ja t2 2,0° koko maailmalle (karkeat kompleksikeskiarvoina
märistä solmuista). Mitattu 15.10.: t0 892 laattaa 6,5 MB, t1 152
laattaa 1,8 MB, t2 15 laattaa 0,15 MB.

KATE: 2°:n bittirasteri (`kate`), jossa solu on vuorovesirannikkoa kun
jossakin sen merisolmussa kevätvuoroveden vaihteluväli 2·(M2 + S2 + K1 +
O1) on yli 0,5 m (docs/aallot.md 8.4, T2). Asiakas päättää siitä
kortin ja kerrosruudun paikan ennen ensimmäistä laattaa.

EPÄUSKOTTAVA (V7, 15.10.): mallin oma arvo on ristiriidassa vuoroveden
teorian kanssa — saman lajin osavuorovesien suhde on lähes vakio (P1/K1
≈ 0,33, K2/S2 ≈ 0,27, N2/M2 ≈ 0,19, Q1/O1 ≈ 0,19), ja S2 on harvoin
M2:ta suurempi. Solmu jossa P1 > 0,6·K1 + 0,05, K2 > 0,6·S2 + 0,05,
N2 > 0,6·M2 + 0,1, Q1 > 0,6·O1 + 0,05 tai S2 > 1,5·M2 + 0,3 merkitään
epäluotettavaksi (2) eikä se ole karkeiden tasojen eikä katteen lähde.
Mitattu 15.10.: 233 solmua — Saint Lawrence Quebecin kohdalla (S2 31 m,
P1 11 m), Amazonin suu, Maracaibo, Hudsoninlahti ja Etelämantereen
rannikko. Kartan näkymässä yksi Quebecin solmu nosti koko maailman
koodausalueen 39 metriin.

EPÄLUOTETTAVA (hyväksymismittari 6): NOAA:n harmonisilla vakioilla
(1 371 asemaa) laskettua asemaennustetta vasten; jos mallin solmu (≤ 20 km)
poikkeaa yli 0,3 m (RMS 30 vrk) tai M2:n vaihe yli 45 min, solmut 15 km:n
sisällä asemasta merkitään (2). Mitattu 15.10.: verrattu 1 242, näistä 549
epäluotettavia — Alaskan lahdet (Bristol Bay RMS 1,4–1,9 m, M2 3 h
myöhässä), Puget Sound (Seattle 1,33 m) ja jokisuut. Niissä asema on
lähellä, ja asiakas käyttää sitä.

NOAA:n ennusteasemat (`noaa.json`: tunnus, lat, lng, nimi, tyyppi R/S)
tulevat samalla: asiakas valitsee lähimmän aseman (≤ 20 km, sama
vesialue EOT20:n M2:n mukaan) ja `api/vesi.js?vuorovesi=noaa` hakee sen
ennusteen.
"""
import gzip, io, json, os, struct, sys, base64, zipfile, tempfile, urllib.request, datetime as dt
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import h5py

OSAT = ['M2', 'S2', 'N2', 'K2', 'K1', 'O1', 'P1', 'Q1']
# PADOTUT VEDET MAAKSI: EOT20:n maski on 0,125°, ja se pitää IJsselmeeriä,
# Markermeeriä ja Amsterdamin IJ:tä merenä (M2 0,7–0,8 m, mitattu 15.10.),
# vaikka Afsluitdijk ja IJmuidenin sulut sulkevat ne vuorovedeltä. Pampus
# on IJmeerillä. Monikulmio on sama kuin DWD EWAM -perheen (`tools/ewam.mjs`)
# ja Noordzeekanaal suorakaiteena (lat, lng).
SULJETUT = [
    [[52.320, 5.060], [52.345, 4.975], [52.395, 4.985], [52.500, 5.050], [52.640, 5.040],
     [52.700, 5.180], [52.765, 5.090], [52.930, 5.020], [53.070, 5.330], [53.095, 5.400],
     [53.000, 5.440], [52.880, 5.340], [52.860, 5.700], [52.680, 5.580], [52.600, 5.850],
     [52.560, 5.750], [52.520, 5.420], [52.420, 5.240], [52.330, 5.170]],
    [[52.36, 4.60], [52.36, 5.00], [52.50, 5.00], [52.50, 4.60]],
]
N = 41
TASOT = [('t0', 0.125, True), ('t1', 0.5, False), ('t2', 2.0, False)]
KATE_ASKEL = 2.0
KATE_RAJA_M = 0.5
NOAA = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi'


def lue_eot20(polku):
    """8 osaa: Re, Im metreinä, pituus −180…180 (2881 saraketta, viimeinen = ensimmäinen)."""
    tmp = None
    if polku.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        z = zipfile.ZipFile(polku)
        sisa = [n for n in z.namelist() if n.endswith('ocean_tides.zip')]
        if sisa:  # SEANOE:n paketissa ocean_tides.zip on zipin sisällä
            z.extract(sisa[0], tmp)
            z = zipfile.ZipFile(os.path.join(tmp, sisa[0]))
        for o in OSAT:
            n = [x for x in z.namelist() if x.endswith(f'/{o}_ocean_eot20.nc') and '__MACOSX' not in x][0]
            with z.open(n) as f, open(os.path.join(tmp, f'{o}.nc'), 'wb') as u:
                u.write(f.read())
        polku = tmp
    RE = np.zeros((len(OSAT), 1441, 2881), np.float32)
    IM = np.zeros_like(RE)
    for k, o in enumerate(OSAT):
        nimi = os.path.join(polku, f'{o}.nc')
        if not os.path.exists(nimi):
            nimi = os.path.join(polku, f'{o}_ocean_eot20.nc')
        f = h5py.File(nimi, 'r')
        lat = f['lat'][:]
        lon = f['lon'][:]
        assert abs(lat[0] + 90) < 1e-6 and abs(lon[0]) < 1e-6 and len(lon) == 2881, 'hila vaihtui'
        re = f['real'][:] / 100.0
        im = f['imag'][:] / 100.0
        # 0…360 → −180…180: sarakkeet 1440…2880 ja 0…1440 (180° ja −180° ovat sama sarake)
        RE[k] = np.concatenate([re[:, 1440:2880], re[:, 0:1441]], axis=1)
        IM[k] = np.concatenate([im[:, 1440:2880], im[:, 0:1441]], axis=1)
    meri = (np.abs(RE).sum(0) + np.abs(IM).sum(0)) > 0
    suljettu = np.zeros(meri.shape, bool)
    for mk in SULJETUT:
        las = [p[0] for p in mk]; los = [p[1] for p in mk]
        for j in range(int((min(las) + 90) / 0.125), int((max(las) + 90) / 0.125) + 2):
            for i in range(int((min(los) + 180) / 0.125), int((max(los) + 180) / 0.125) + 2):
                if sisalla(mk, -90 + j * 0.125, -180 + i * 0.125):
                    meri[j, i] = False
                    suljettu[j, i] = True
                    RE[:, j, i] = 0
                    IM[:, j, i] = 0
    return RE, IM, meri, suljettu


def sisalla(mk, la, lo):
    """Piste monikulmion sisällä (parillisuussääntö, kuten `tools/ewam.mjs`)."""
    s = False
    j = len(mk) - 1
    for i in range(len(mk)):
        ya, xa = mk[i]; yb, xb = mk[j]
        if (ya > la) != (yb > la) and lo < (xb - xa) * (la - ya) / (yb - ya) + xa:
            s = not s
        j = i
    return s


# -- Tähtitieteelliset argumentit ja nodaalikorjaukset (Schureman; sama kuin
#    sovelluksen `Vuorovesi._argumentit`). Vuorokautisten vaihe −90 (K1) ja
#    +90 (O1, P1, Q1): toisinpäin Honolulun RMS oli 0,22 m, näin 0,03 m.
def argumentit(t):
    D = (t - dt.datetime(2000, 1, 1, 12, tzinfo=dt.timezone.utc)).total_seconds() / 86400.0
    s = 218.3164477 + 13.17639648 * D
    h = 280.4664567 + 0.98564736 * D
    p = 83.3532465 + 0.11140353 * D
    Nn = np.radians(125.0445479 - 0.05295377 * D)
    T = 180.0 + 15.0 * (t.hour + t.minute / 60 + t.second / 3600)
    V = [2*T - 2*s + 2*h, 2*T, 2*T - 3*s + 2*h + p, 2*T + 2*h,
         T + h - 90, T - 2*s + h + 90, T - h + 90, T - 3*s + h + p + 90]
    fO = 1.009 + 0.187*np.cos(Nn) - 0.015*np.cos(2*Nn)
    uO = 10.8*np.sin(Nn) - 1.3*np.sin(2*Nn)
    f = [1 - 0.037*np.cos(Nn), 1.0, 1 - 0.037*np.cos(Nn), 1.024 + 0.286*np.cos(Nn) + 0.008*np.cos(2*Nn),
         1.006 + 0.115*np.cos(Nn) - 0.009*np.cos(2*Nn), fO, 1.0, fO]
    u = [-2.1*np.sin(Nn), 0.0, -2.1*np.sin(Nn), -17.7*np.sin(Nn) + 0.7*np.sin(2*Nn),
         -8.9*np.sin(Nn) + 0.7*np.sin(2*Nn), uO, 0.0, uO]
    return np.radians(np.array(V) + np.array(u)), np.array(f)


def argumenttitaulu(ajat):
    """Argumentit ja kertoimet kerran koko jaksolle: (cos, sin) × f, muoto [aika][osa]."""
    A = np.array([argumentit(t)[0] for t in ajat])
    F = np.array([argumentit(t)[1] for t in ajat])
    return F * np.cos(A), F * np.sin(A)


def synteesi(re, im, taulu):
    c, s = taulu
    return c @ re + s @ im


def lahin_solmu(meri, la, lo, maxkm):
    j0 = int(round((la + 90) / 0.125))
    i0 = int(round((lo + 180) / 0.125))
    paras = None
    r = int(np.ceil(maxkm / 13.9)) + 1
    for dj in range(-r, r + 1):
        j = j0 + dj
        if j < 0 or j > 1440:
            continue
        for di in range(-r * 3, r * 3 + 1):
            i = (i0 + di) % 2880
            if not meri[j, i]:
                continue
            d = np.hypot(dj * 0.125 * 111.2, ((i * 0.125 - 180 - lo + 180) % 360 - 180) * 111.2 * np.cos(np.radians(la)))
            if d <= maxkm and (paras is None or d < paras[0]):
                paras = (d, j, i)
    return paras


def hae_json(url, yrityksia=3):
    for k in range(yrityksia):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'FoilSpot'}), timeout=60))
        except Exception as e:
            if k == yrityksia - 1:
                raise
    return None


def noaa_validointi(RE, IM, meri):
    """Merkitsee epäluotettavat solmut (2) NOAA:n harmonisia vakioita vasten."""
    asemat = hae_json(f'{NOAA}/stations.json?type=harcon')['stations']
    alku = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    taulu = argumenttitaulu([alku + dt.timedelta(hours=k) for k in range(30 * 24)])

    def yksi(a):
        try:
            la, lo = float(a['lat']), float(a['lng'])
            s = lahin_solmu(meri, la, lo, 20.0)
            if s is None:
                return None
            hc = hae_json(f'{NOAA}/stations/{a["id"]}/harcon.json?units=metric')['HarmonicConstituents']
            k = {x['name']: x for x in hc}
            if not all(o in k for o in OSAT):
                return None
            A = np.array([k[o]['amplitude'] for o in OSAT])
            G = np.radians([k[o]['phase_GMT'] for o in OSAT])
            asema = synteesi(A * np.cos(G), A * np.sin(G), taulu)
            d, j, i = s
            malli = synteesi(RE[:, j, i], IM[:, j, i], taulu)
            rms = float(np.sqrt(np.mean((malli - asema) ** 2)))
            dm2 = (np.degrees(np.angle(complex(RE[0, j, i], IM[0, j, i]))) - k['M2']['phase_GMT'] + 180) % 360 - 180
            min_m2 = abs(dm2) / 28.984104 * 60
            return (a['id'], a['name'], la, lo, round(d, 1), round(rms, 3), round(min_m2, 0), float(np.std(asema)))
        except Exception:
            return None

    with ThreadPoolExecutor(8) as ex:
        tulokset = [x for x in ex.map(yksi, asemat) if x]
    huonot = [x for x in tulokset if x[5] > 0.3 or x[6] > 45]
    print(f'NOAA: {len(asemat)} asemaa, verrattu {len(tulokset)}, epäluotettavia {len(huonot)}')
    for x in sorted(huonot, key=lambda x: -x[5])[:12]:
        print(f'  {x[1][:30]:30s} {x[4]:5.1f} km  RMS {x[5]:.2f} m  M2 {x[6]:.0f} min')
    epa = np.zeros(meri.shape, bool)
    for x in huonot:
        la, lo = x[2], x[3]
        j0 = int(round((la + 90) / 0.125))
        i0 = int(round((lo + 180) / 0.125))
        for dj in range(-3, 4):
            for di in range(-6, 7):
                j, i = j0 + dj, (i0 + di) % 2880
                if 0 <= j <= 1440:
                    d = np.hypot(dj * 0.125 * 111.2, di * 0.125 * 111.2 * np.cos(np.radians(la)))
                    if d <= 15:
                        epa[j, i] = True
    epa[:, 2880] = epa[:, 0]
    return epa & meri, tulokset


def noaa_asemat():
    s = hae_json(f'{NOAA}/stations.json?type=tidepredictions')['stations']
    return [[x['id'], round(float(x['lat']), 4), round(float(x['lng']), 4), x['name'], x.get('type') or 'R'] for x in s]


def epauskottavat(RE, IM, meri):
    """Solmut joiden osavuorovesien suhteet ovat fysikaalisesti mahdottomia."""
    M2, S2, N2, K2, K1, O1, P1, Q1 = np.hypot(RE, IM)
    return ((P1 > 0.6 * K1 + 0.05) | (K2 > 0.6 * S2 + 0.05) | (N2 > 0.6 * M2 + 0.1)
            | (Q1 > 0.6 * O1 + 0.05) | (S2 > 1.5 * M2 + 0.3)) & meri


def karkea(RE, IM, meri, askel):
    """Kompleksikeskiarvo märistä solmuista ± askel/2 -laatikossa."""
    k = int(round(askel / 0.125))
    ny, nx = int(180 / askel) + 1, int(360 / askel) + 1
    re = np.zeros((len(OSAT), ny, nx), np.float32)
    im = np.zeros_like(re)
    m = np.zeros((ny, nx), bool)
    h = k // 2
    for j in range(ny):
        j0, j1 = max(0, j * k - h), min(1441, j * k + h + 1)
        for i in range(nx):
            ii = [(x % 2880) for x in range(i * k - h, i * k + h + 1)]
            mm = meri[j0:j1][:, ii]
            if not mm.any():
                continue
            m[j, i] = True
            for o in range(len(OSAT)):
                re[o, j, i] = RE[o, j0:j1][:, ii][mm].mean()
                im[o, j, i] = IM[o, j0:j1][:, ii][mm].mean()
    return re, im, m


def kirjoita_taso(ulos, tid, askel, re, im, maski, vain_ranta):
    """Laatat 41 × 41 (span 40 × askel); palauttaa listan [lat0, lng0] ja tavut."""
    span = (N - 1) * askel
    laatat, tavut = [], 0
    os.makedirs(os.path.join(ulos, tid), exist_ok=True)
    ny, nx = maski.shape
    for la0 in np.arange(-90, 90 - 1e-9, span):
        for lo0 in np.arange(-180, 180 - 1e-9, span):
            j0 = int(round((la0 + 90) / askel))
            i0 = int(round((lo0 + 180) / askel))
            js = np.minimum(j0 + np.arange(N), ny - 1)
            is_ = (i0 + np.arange(N)) % (nx - 1)
            m = maski[np.ix_(js, is_)]
            if not m.any():
                continue
            if vain_ranta and (m > 0).all():
                continue
            r = re[:, js][:, :, is_]
            i_ = im[:, js][:, :, is_]
            sk = np.maximum(np.abs(r).max(axis=(1, 2)), np.abs(i_).max(axis=(1, 2)))
            sk = np.where(sk > 0, sk, 1e-3).astype(np.float32)
            q = np.empty((len(OSAT), 2, N, N), np.int8)
            q[:, 0] = np.clip(np.round(r / sk[:, None, None] * 127), -127, 127)
            q[:, 1] = np.clip(np.round(i_ / sk[:, None, None] * 127), -127, 127)
            otsake = b'FSVV' + struct.pack('<BBH', 1, len(OSAT), 0) + struct.pack('<fff', askel, la0, lo0) \
                + struct.pack('<HH', N, N) + sk.tobytes()
            assert len(otsake) == 56
            # mtime=0: sama sisältö on sama tiedosto, joten uusi ajo muuttaa
            # repossa vain ne laatat joiden data muuttui.
            data = gzip.compress(otsake + q.tobytes() + m.astype(np.uint8).tobytes(), 9, mtime=0)
            nimi = f'{la0:g}_{lo0:g}'
            with open(os.path.join(ulos, tid, nimi + '.bin.gz'), 'wb') as f:
                f.write(data)
            laatat.append([float(f'{la0:g}'), float(f'{lo0:g}')])
            tavut += len(data)
    return laatat, tavut


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    ulos = sys.argv[2] if len(sys.argv) > 2 else 'public/vuorovesi'
    RE, IM, meri, suljettu = lue_eot20(sys.argv[1])
    print(f'EOT20: merisolmuja {meri.sum()} ({meri.mean() * 100:.1f} %)')
    huono = epauskottavat(RE, IM, meri)
    print(f'epäuskottavia solmuja {int(huono.sum())}')
    hyva = meri & ~huono
    epa, vertailut = noaa_validointi(RE, IM, hyva)
    maski0 = meri.astype(np.uint8) + (epa | huono).astype(np.uint8)
    maski0[suljettu] = 3
    os.makedirs(ulos, exist_ok=True)
    tasot = []
    for tid, askel, vain_ranta in TASOT:
        if askel == 0.125:
            re, im, m = RE, IM, maski0
        else:
            re, im, mm = karkea(RE, IM, hyva, askel)
            m = mm.astype(np.uint8)
        laatat, tavut = kirjoita_taso(ulos, tid, askel, re, im, m, vain_ranta)
        print(f'{tid}: {askel}°, {len(laatat)} laattaa, {tavut / 1e6:.2f} MB')
        tasot.append({'id': tid, 'askel': askel, 'span': (N - 1) * askel, 'laatat': laatat})
    # Kate: 2° solu jossa kevätvuoroveden vaihteluväli > 0,5 m jossakin merisolmussa.
    amp = np.hypot(RE, IM)
    vali = 2 * (amp[0] + amp[1] + amp[4] + amp[5])
    k = int(round(KATE_ASKEL / 0.125))
    kny, knx = int(180 / KATE_ASKEL), int(360 / KATE_ASKEL)
    bitit = np.zeros(kny * knx, np.uint8)
    for j in range(kny):
        for i in range(knx):
            v = vali[j * k:(j + 1) * k + 1, i * k:(i + 1) * k + 1]
            mm = hyva[j * k:(j + 1) * k + 1, i * k:(i + 1) * k + 1]
            if (v[mm] > KATE_RAJA_M).any():
                bitit[j * knx + i] = 1
    kate = base64.b64encode(np.packbits(bitit).tobytes()).decode()
    asemat = noaa_asemat()
    with open(os.path.join(ulos, 'noaa.json'), 'w') as f:
        json.dump(asemat, f, separators=(',', ':'), ensure_ascii=False)
    luettelo = {
        'versio': 1, 'malli': 'EOT20', 'luotu': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'lahde': 'DGFI-TUM EOT20 · CC BY 4.0', 'osat': OSAT, 'n': N, 'otsake': 56,
        'tasot': tasot,
        'kate': {'askel': KATE_ASKEL, 'la0': -90, 'lo0': -180, 'nx': knx, 'ny': kny, 'raja': KATE_RAJA_M, 'bitit': kate},
        'noaa': {'asemia': len(asemat), 'verrattu': len(vertailut),
                 'epaluotettavia': sum(1 for x in vertailut if x[5] > 0.3 or x[6] > 45)},
    }
    with open(os.path.join(ulos, 'luettelo.json'), 'w') as f:
        json.dump(luettelo, f, separators=(',', ':'), ensure_ascii=False)
    print(f'kate: {int(bitit.sum())}/{bitit.size} solua, NOAA-asemia {len(asemat)}')


if __name__ == '__main__':
    main()
