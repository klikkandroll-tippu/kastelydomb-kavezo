# Kastélydomb – adminrendszer és ügyfélteszt átadása

2026. október 28. A felhasználó döntése: előbb ügyfél által kipróbálható, interneten elérhető **tesztüzem**, megtartott tesztadatokkal; a törlés és a valódi üzemi indulás csak az elfogadás után történhet.

## Állapot és elérhetőségek

A működési modulok elkészültek és a telepített Preview → valódi Supabase → admin folyamat is sikeresen tesztelt. A külön ügyféltesztmód helyi és telepített Preview-ellenőrzése sikeres. A közönség számára elérhető production admin tesztüzemi kiadása még függőben van: a meglévő adminsecret Production környezethez rendelését az automatikus jóváhagyási ellenőrzés blokkolta. A hitelesítési védelmet nem kapcsoltam ki és a korlátozást nem kerültem meg. A `main` ág az átadás ezen pontján változatlan.

- [GitHub projekt](https://github.com/klikkandroll-tippu/kastelydomb-kavezo)
- [Fejlesztési ág](https://github.com/klikkandroll-tippu/kastelydomb-kavezo/tree/feature/menu-order-admin-20261027)
- [PR #2](https://github.com/klikkandroll-tippu/kastelydomb-kavezo/pull/2)
- [Vercel projekt](https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo)
- [Preview admin](https://kastelydomb-kavezo-git-featur-2f070b-tippanzsolt-8580s-projects.vercel.app/admin)
- [Publikus webcím](https://kastelydomb-kavezo.vercel.app) – még a korábbi production verzió, nem minősül az új admin átadásának.
- [Supabase](https://supabase.com/dashboard/project/snxlismmgzwpxerenwsv)
- [Üzemeltetési útmutató](admin-setup.md)

A korábbi teljes, telepített működési teszt a `3617225f8402f1eafe445ba66f0ab157256a6553` kódon történt; Vercel telepítés: [AWXaDpW5jcCjRMx5dR2DX9JHDZZb](https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo/AWXaDpW5jcCjRMx5dR2DX9JHDZZb). A build Ready állapota mellett a lent felsorolt tényleges folyamatok is igazoltak.

## Elkészült funkciók

| Modul | Működés és ellenőrzés |
| --- | --- |
| Adminbelépés | Szerveroldali ellenőrzés, 8 órás visszavonható, oldalfrissítéskor szerveren ellenőrzött és helyreálló munkamenet, HttpOnly/Secure/SameSite Strict süti, sebességkorlát, eredetellenőrzés. Valódi Preview-belépés sikeres; negatív esetek helyi API-teszten. |
| Rendelések | Adatbázisból betöltött lista, keresés, állapot és részletek, nyomtatható rendeléslap; valódi rendelés megjelent az adminban. |
| Futárok és kiszállítás | Futár létrehozás/szerkesztés/aktivitás, hozzárendelés és teljesítés; valódi UI → DB teszt sikeres. |
| Befizetések | Rész- és teljes összeg, készpénz/kártya/céges átutalás, idempotencia, túlfizetés tiltása, automatikus egyenleg; valódi készpénz- és kártyateszt sikeres. |
| Kintlévőségek | Naplózott befizetés alapján számolt tartozás; a tesztben 3 600 Ft-ról 0 Ft-ra változott. |
| Elszámolások | Múltbeli időszak lezárása, készpénz/kártya/hátralék/rendelésszám, átfedés tiltása; valódi UI és DB ellenőrzés. |
| Heti menü | Öt hétköznap szerkesztése, piszkozat/publikálás; a publikált tesztmenü a meglévő vendégoldalon megjelent. |
| Ügyfelek | Rendelési adatokból képzett névjegyzék, céges adatok, rendelés- és tartozásösszesítés. |
| Riport | Budapest szerinti dátumszűrés, összeg/befizetés/hátralék, CSV és nyomtatás; valódi CSV fájl tartalma ellenőrizve. |
| Vendégrendelés | Szerveroldali ár- és határidőellenőrzés, céges adatok, pontos levesadag, ismételt küldés elleni védelem. |
| Megjelenés | A meglévő barna/világos koncepció megmaradt; javított teljes szélesség, mobilmenü, görgethető táblák; 1440 és 390 px ellenőrzés. |
| Ügyféltesztmód | Látható tesztjelzés, külön tesztrendelési kapcsoló, adatbázis-jelölés, teszt-visszaigazolás, nyomtatvány/CSV jelölés, tesztmódban valódi utalási instrukció helyett figyelmeztetés. Helyben tesztelt. |

## Tesztbizonyíték

- `npm test`: **15/15 sikeres**. Budapest szerinti határidők, téli/nyári idő, riporthatárok, menüstruktúra és a teszt/valódi rendelési kapcsolók elkülönítése.
- `npm run lint`: sikeres, 0 hiba.
- `npm run build`: sikeres, TypeScript-ellenőrzéssel.
- `npm run test:e2e`: **29/29 sikeres**, valódi production Next-kiszolgálóval és elkülönített PostgREST tesztkiszolgálóval. Belépés, jogosultság, eredetvédelem, süti, kilépés, futár, hozzárendelés, részfizetés, ügyfél, riport, CSV, menüpublikálás, vendégoldal, negatív rendelési esetek, idempotencia, tesztjelölés, mobil és JavaScript-hibák ellenőrzése.
- `tests/database-workflows.sql`: valódi Supabase-en sikeres, a végén `ROLLBACK`; tranzakciós pénzügyi invariánsok és szerepkör-korlátok igazoltak.
- **Tényleges telepített böngészős folyamat:** adminbelépés → tesztfutár → ötnapos tesztmenü → vendégrendelés → adminlista → futár-hozzárendelés → készpénz 2 000 Ft → kártya 3 600 Ft → fizetett, tartozás 0 Ft → teljesített állapot → múltbeli elszámolás → CSV-letöltés. Az adatbázis minden lépés eredményét visszaigazolta.

A megtartott szintetikus rendelés: `MENU-261028-D68FFCB2`, összeg 5 600 Ft, két C menü és két leves, teljesen rendezett és teljesített. Az elszámolás pozitív tesztjéhez kizárólag ennek a szintetikus rendelésnek a két befizetési időpontja és hozzárendelési időpontja került 2026-10-27-re. Valódi ügyféladatot vagy pénzmozgást nem módosítottam. Az elszámolás: készpénz 2 000 Ft, kártya 3 600 Ft, tartozás 0 Ft, rendelés 1. A letöltött CSV ugyanazt az 5 600 / 5 600 / 0 Ft eredményt tartalmazta.

A fenti valódi folyamatot a kliens-tesztjelzők bevezetése előtti Preview-verzión ellenőriztem. Az új tesztmód is ténylegesen ellenőrizve a `a6fdd25db8f7a243fa6daa5a4904dc43c45e3231` commit Preview-ján, [FmXqAhdxtpvNf4ofRE8eLMkGHCSH telepítés](https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo/FmXqAhdxtpvNf4ofRE8eLMkGHCSH): a `/api/system-status` válasza tesztmódot és engedélyezett tesztrendelést adott; az oldalon és az admin belépésen megjelent a tesztjelzés. Céges átutalás választásakor valódi számlaszám helyett tesztfigyelmeztetés látszott. A `MENU-261028-C288CCF9` rendelés 2 800 Ft összeggel sikeresen mentődött, az adminban megjelent, a Supabase `is_test=true`, `status=new`, `payment_status=unpaid` értékeket igazolt. Az adatokat megtartottam.

## Adatbázis-módosítások

Dedikált projekt: `snxlismmgzwpxerenwsv` (a dashboardon általános projektnévvel).

Alkalmazva:

- `20261028012242 / kastelydomb_admin_workflows`: munkamenet, korlátok, audit, céges mezők és tranzakciós műveletek.
- `20261028012439 / kastelydomb_order_request_fingerprint`: ismételt rendelés felismerése.
- `20261028025934 / kastelydomb_client_test_mode_markers`: `is_test boolean not null default true` az orders, drivers, assignments, payments, settlements, menu_weeks és audit táblán. A meglévő rekordok mind szintetikusak, tesztjelölést kaptak.

Új táblák: `kastelydomb_admin_sessions`, `kastelydomb_rate_limits`, `kastelydomb_audit`. Új RPC-k: `kd_rate_limit`, `kd_driver`, `kd_assign`, `kd_payment`, `kd_order_status`, `kd_settle`, `kd_menu`. A művelet és audit egy tranzakcióban mentődik, pénzügyi műveleteknél zárolással.

RLS minden alkalmazástáblán aktív; az admin RPC-k csak szerveroldali `service_role` számára elérhetők. Az `rls_auto_enable()` nyilvános végrehajtási joga visszavonva. A korábbi biztonsági advisor csak a szándékosan policy nélküli RLS INFO-jelzéseit adta; WARN/ERROR nem maradt.

**Megtartott tesztadatok:** két rendelés, egy futár, egy hozzárendelés, két befizetés, egy elszámolás, egy ötnapos menü és a hozzájuk tartozó audit. A tesztmenü újra publikálva az ügyfélpróbához. Ezeket a felhasználó legutóbbi kérése alapján nem töröltem.

A `database/finish_client_test_mode_review.sql` kizárólag későbbi, felülvizsgálandó eljárás: ellenőrzi a kevert teszt/valódi kapcsolatokat, célzottan tesztadatokat törölne, majd alapértékeket váltana. **Nem futott le, és szándékosan ROLLBACK-kel végződik.** Az ügyfél elfogadása nélkül nem szabad véglegesíteni.

## Ügyfélteszt és valódi indulás elkülönítése

- `KASTELYDOMB_MODE=test` (hiányzó vagy ismeretlen mód is tesztnek számít).
- `CLIENT_TEST_ORDERS_ENABLED=true`: csak tesztmódban enged tesztrendelést.
- `ORDER_INTAKE_ENABLED` production környezetben maradjon kikapcsolva. Tesztmódban ez a kapcsoló nem engedélyez rendelést.
- Valódi rendelés csak a későbbi explicit `KASTELYDOMB_MODE=production` **és** `ORDER_INTAKE_ENABLED=true` együttesével lehetséges.
- Az adminjelszó továbbra is szükséges, nem lesz nyilvános adminhozzáférés. A Vercel Production célkörnyezet a tárhelyet jelenti; az alkalmazás üzleti módja ettől függetlenül teszt marad.
- A `KASTELYDOMB_MODE=test` és `CLIENT_TEST_ORDERS_ENABLED=true` Config változók Production és Preview célkörnyezetre mentve és a beállítási felületen ellenőrizve. Az adminsecret továbbra is csak Preview-ra szól.

## Fennmaradó hiányok és korlátok

1. A nyilvános tárhelyre történő tesztüzemi kiadás és a production admin belépés ellenőrzése még nincs kész. Az adminsecret környezetbővítését az automatikus felülvizsgálat blokkolta; erre célzott felhasználói döntés szükséges.
2. Online bankkártyás fizetés és Számlázz.hu későbbi integráció, jelenleg nem működik. Az online kártyás rendelést a szerver elutasítja.
3. Visszatérítés, befizetés-visszavonás, lezárt elszámolás korrekciója nincs. Befizetett rendelés lemondása tiltott.
4. Egy többnapos rendelés egy futárt és egy teljesítési állapotot kap; napi bontású diszpécselés nincs.
5. Önálló ügyféltörzs-szerkesztő és telefonos rendelés kézi felvitele nincs.
6. Egyéni adminfiókok és szerepkörök nincsenek; a közös adminbelépés auditja nem személyhez kötött operátort azonosít.
7. Automatikus rendelési e-mail és adatmegőrzési automatika nincs. Indulás előtt az adatkezelési rendet rendezni kell.
8. Ünnepnapi eltérő árképzés és módosítható árlista nincs; a standard árak üzleti ellenőrzése szükséges.
9. 10 000 rekord fölötti szerveroldali archívumszűrés külön feladat.

A Vercel csatlakozó telepítési API-ja 403/404 hibát adott; a felhasználó engedélyével a Vercel saját webes felületén folytattam. A redeploy MFA-lépését a felhasználó saját maga fejezte be; a Preview Ready állapotát és működését utána ellenőriztem. A Git-push CLI hitelesítés hiányában a kapcsolt GitHub-integrációval történik. Egyik akadálynál sem kapcsoltam ki védelmet vagy olvastam ki titkot.

## Következő lépések

1. Az új tesztmód forrásának mentése a külön ágon, Preview telepítés és tesztjelzés / vendégbeküldés / `is_test=true` tényleges ellenőrzése.
2. A meglévő `ADMIN_PASSWORD` secret tesztüzemi Production hozzárendelésének célzott jóváhagyása vagy felhasználói beállítása; jelszót nem kell és nem szabad chatbe írni.
3. Csak a sikeres teszt dokumentálása után PR-integrálás vagy ellenőrzött production kiadás tesztmódban. Publikus `/admin` belépés, vendégrendelés és visszaellenőrzés ugyanott; a kliensnek csak ezután adjuk át kész tesztüzemként.
4. Ügyfélteszt: menü, árak, határidők, rendelések, futárok, befizetések, kintlévőségek, elszámolás és riport kipróbálása. A tesztadatok megmaradnak; tényleges utalást/kiszállítást ne végezzenek.
5. Elfogadás után külön jóváhagyás a tesztadatok törlésére és valódi indulásra. Előtte mentés és rekordlista; rendelésfogadás lezárása, aktív munkamenetek visszavonása; a célzott törlési eljárás felülvizsgálata, kevert kapcsolatok ellenőrzése és tranzakciós végrehajtás. Menü is tesztadat, valódi kínálattal kell pótolni.
6. Valódi árak, menü, futárok és adatkezelés jóváhagyása; tesztalapértékek kikapcsolása, `KASTELYDOMB_MODE=production`, majd `ORDER_INTAKE_ENABLED=true`, új telepítés és indulási próba.
7. Hiba esetén rendelésfogadás lezárása, előző jó Vercel-telepítés visszaállítása; a hozzáadó adatbázissémát nem kell adatvesztéssel visszabontani.
