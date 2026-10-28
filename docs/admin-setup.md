# Kastélydomb admin – üzemeltetés és tesztelés

Állapot: 2026. október 28. Fejlesztési ág: `feature/menu-order-admin-20261027`.
Az élesítés feltételeit és a tényleges tesztbizonyítékokat az [átadási jelentés](admin-handover-2026-10-28.md) tartalmazza.

## Szerveroldali környezeti változók

| Név | Rendeltetés |
| --- | --- |
| `SUPABASE_URL` | A Kastélydomb elkülönített projektjének API URL-je |
| `SUPABASE_SERVICE_ROLE_KEY` | Kizárólag a szerver által használt Supabase kulcs |
| `ADMIN_PASSWORD` vagy `ADMIN_PASSWORD_SHA256` | Legalább 16 karakteres egyedi adminjelszó, vagy annak SHA-256 hex kivonata; a kivonat elsőbbséget élvez |
| `KASTELYDOMB_MODE` | Ügyfélteszthez `test`; valódi induláskor külön jóváhagyással `production`. Hiányzó/eltérő érték tesztmód. |
| `CLIENT_TEST_ORDERS_ENABLED` | `true` csak tesztmódban enged tesztrendelést. |
| `ORDER_INTAKE_ENABLED` | `true` kizárólag explicit production alkalmazásmódban enged valódi rendelést; ügyfélteszt alatt maradjon kikapcsolva. |

Ezeket a Vercel megfelelő Preview/Production környezeteiben kell megadni. Egyik titokhoz se használjon `NEXT_PUBLIC_` előtagot. Kulcsot vagy jelszót ne írjon a forráskódba és ne másoljon hibajegybe. Az adminhoz HTTPS szükséges; a munkamenetsüti production környezetben Secure.

## Adatbázis

A használt projekt: `snxlismmgzwpxerenwsv`. A táblák és a migrációs előzmények alapján ez a Kastélydomb-adatbázis; a dashboardon látható általános projektnév nem az alkalmazás neve.

Az eredeti rendelési sémát követik az operatív táblák, majd:

1. `database/kastelydomb_admin_workflows.sql` – munkamenet, sebességkorlát, audit, szerveroldali üzleti műveletek és céges számlázási mezők.
2. `database/kastelydomb_order_request_fingerprint.sql` – ismételt rendelésbeküldés felismerése.
3. `database/kastelydomb_client_test_mode.sql` – tesztadat-jelölők. Alapértékük a tesztidőszakban true; a valódi indulás előtt átállítandó.

Az ügyfélteszt adatainak törlése csak külön elfogadás után történhet. A `database/finish_client_test_mode_review.sql` felülvizsgálati minta, szándékosan ROLLBACK-kel zárul; nem automatikus törlőprogram.

Ezek már alkalmazva lettek a fenti projekten. Ne futtassa őket szükségtelenül újra. Új környezetben a meglévő migrációs előzményekkel összevetve, sorrendben telepítse a sémákat.

Minden alkalmazástábla RLS-védett. Az `anon` és `authenticated` szerepkör nem kap közvetlen hozzáférést a személyes adatokhoz és az admin RPC-khez. Az admin API a szerveroldali kulccsal dolgozik. A policy nélküli RLS ebben a modellben szándékos teljes kliensoldali tiltás.

## Működés

- Belépés után 8 órás HttpOnly / Secure / SameSite=Strict munkamenet készül. Oldalfrissítéskor a szerver újraellenőrzi a sütit és helyreállítja a belépést. A kijelentkezés törli az adatbázisban tárolt munkamenetet is.
- A belépési korlát 10 kísérlet / 15 perc; a Vercel megbízható továbbított IP-fejlécét használja, ennek hiányában közös korlátot. A rendelési korlát 30 kísérlet / 15 perc. A kulcsokban az IP csak kivonatként szerepel.
- A nyers adminjelszó csak a belépési kérésben szerepel; a további API-kérések munkamenetsütit használnak.
- Futár csak aktív kiszállításhoz rendelhető. Futárhoz kötött befizetés után nem cserélhető másik futárra.
- A befizetés naplózott, részösszeg is lehet; túlfizetés nem menthető. Az ismételt kérés ugyanazzal a kérésazonosítóval nem hoz létre új befizetést.
- Fizetett rendelés lemondása visszatérítési egyeztetést igényel. Visszatérítési könyvelési művelet jelenleg nincs.
- Futárelszámolás csak már lezárult napokra készíthető. Átfedő időszak kétszer nem zárható le. A készpénz és a kártya a befizetés dátuma, a rendelésszám a hozzárendelés dátuma szerint számolódik. Az eltérés időzítési okból lehetséges.
- Az ügyfélnézet a rendelési adatokból képzett névjegyzék; a riport rendelés-létrehozási dátum szerint szűr. A dátumkezelés Budapest időzónáját használja.
- A menü öt egymást követő hétköznapot tartalmaz. Piszkozat menthető, a publikált menü a meglévő `/napi-menu` képernyőn jelenik meg. Ünnepnapi eltérő árazás nem publikálható ezen a szerkesztőn.
- A szerver újraszámolja az összeget, ellenőrzi a határidőt és a rendelési szabályokat. A jelenlegi A/B, C és leves árak a meglévő rendelőből származnak; indulás előtt üzletileg jóvá kell hagyni őket.
- Az admin 10 000-es adatlekérési védőkorlátot alkalmaz. A korlát túllépésekor hibát jelez, nem jelenít meg észrevétlenül hiányos összesítést.

## Ellenőrzés

Node.js 24 és az elkötelezett lockfile használata ajánlott.

```bash
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Az E2E teszt maga indítja a production Next-kiszolgálót a 3100-as és egy elkülönített PostgREST tesztkiszolgálót a 3101-es porton. A production buildnek előbb el kell készülnie. Valós kulcsot nem használ, valós rendelést nem hoz létre. Alternatív helyi Chromium esetén `TEST_CHROMIUM_EXECUTABLE` adható meg. A képi teszteredmények alapértelmezett helye a verziókezelésből kizárt `test-results/`; a hely `TEST_ARTIFACT_DIR` változóval módosítható.

A `tests/database-workflows.sql` a valódi Supabase üzleti függvényeit ellenőrzi `service_role` jogosultsággal, a tranzakció végén `ROLLBACK`-kel. Tesztadatot nem tart meg. Futtatását és eredményét külön kell dokumentálni.

A helyi E2E és az adatbázisteszt együtt sem helyettesíti a Vercel Preview → valódi Supabase → admin folyamat ellenőrzését. Élesítés előtt ez is kötelező.

## Hibakeresés

- 401: hibás jelszó, hiányzó vagy lejárt munkamenet.
- 403: más eredetű módosító kérés, vagy a Vercel szintjén elégtelen jogosultság. A kettőt a válasz forrása alapján különítse el.
- 429: a belépési/rendelési sebességkorlát elérve.
- 503: hiányzó szerverkonfiguráció, adatbázis-elérési hiba vagy kikapcsolt rendelésfogadás.
- Üres menü: előbb menteni és publikálni kell egy aktuális hetet; a demótartalom nem válik automatikusan rendelhető éles menüvé.
- Vercel 403 esetén a kapcsolt fiók csapat- és projektjogosultságát kell helyreállítani; a Deployment Protection kikapcsolása nem javítás erre.
