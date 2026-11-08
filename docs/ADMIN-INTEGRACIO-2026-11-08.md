# Kastélydomb adminintegráció – állapot és kapcsolási térkép
2026-11-08 | Fejlesztési ág: `feature/admin-integration-20261108` | Kiindulás: `fix/ugyfelteszt-egyseges-20261103`

## Ellenőrzött tények
- Supabase projekt: `snxlismmgzwpxerenwsv` (ACTIVE_HEALTHY).
- `kastelydomb_orders`: 10, mind teszt; `kastelydomb_christmas_orders`: 0; `kastelydomb_payments`: 2, mind teszt.
- Rendelési adatstruktúra: `kastelydomb_orders.items` JSONB tartalmazza az egyes napok menü-, leves- és mennyiségtételeit; `fulfillment` pickup/delivery/dine_in.
- A jelenlegi publikálás előtti webágnak `/api/napi-menu-rendeles`, `/api/karacsonyi-rendeles`, `/api/inquiries` a beküldési végpontjai. Jelenleg Zapier webhookra küldenek; a menürendelés és a karácsonyi megrendelés még **nem** írja közvetlenül a Supabase rendelési tábláit.
- Az admin egy másik, `feature/menu-order-admin-20261027` ágban található. A két fejlesztést nem szabad vakon összeolvasztani: az űrlapútvonalak, árak, érvényesítések és megjelenítés eltérnek.

## Elkészült
- Két, RLS-sel védett, szerveroldali írásra tervezett tábla: `kastelydomb_contacts`, `kastelydomb_reservations`.
- A migráció a fenti Supabase projekten lefutott; más adat és régi tábla nem változott.

## Kötelező további sorrend
1. Közös, szerveroldali adatmentési és értesítési outbox-logika, ismételt beküldés elleni védelemmel; a vendég ne kapjon hamis sikerjelzést.
2. A négy endpoint **ellenőrzött** bekötése az adatbázisba; napi menünél a `takeaway` → `pickup` konverzió, a naponkénti tételek, a teljes rendelési összeg megőrzése. Minden megrendelés azonosítója stabil maradjon.
3. Alkalmi ajánlatok közös kategóriaazonosítója; Karácsony 2026 migrálása adatvesztés nélkül.
4. Az admin külön ágának szelektív beemelése, biztonságos autentikáció és szerepkörengedélyek (szuperadmin, iroda, pultos, egy futár). Az adminhoz **nem** szabad anonim adatvégpontot készíteni.
5. Kiszállítási teendők napi tételszintű listája; futár által jelölt beszedés ≠ pultos által elfogadott befizetés.
6. V1.4-es HTML prototípus dizájnjának beépítése Next.js-be, ha az eredeti prototípus forrása hozzáférhető.
7. Teljes integrációs tesztek (végpont → DB → admin → e-mail), jogosultsági negatív tesztek, izolált tesztrendelések; élesítés kizárólag teljes PASS után.

## Biztonsági kapuk
- Az integráció fejlesztési ága nem a production domain.
- Supabase `service_role` kizárólag szerveroldalon, `NEXT_PUBLIC_` nélkül.
- Minden érkező rekord `is_test` jelölést kap; tesztadatokat nem törlünk automatikusan.
- A jelenlegi weboldali webhook-küldést nem kapcsoljuk ki a tartós adatmentés és a hibakezelés tesztje előtt.
- Korábbi admin `ADMIN_PASSWORD` secretet a tesztágról nem másolunk ki, és jelszót nem írunk a forrásba.

## Végrehajtás és QA – 2026-11-08
- PASS: RLS-védett kapcsolati és foglalási tábla létrejött, beillesztési próba tranzakciós ROLLBACK-kel sikeres; a teszt után mindkét tábla üres.
- PASS: a korábbi admin session/API kódja az integrációs ágra átkerült; új védett `/api/admin/intake` lekérdezés és `/admin` kezdeti, olvasási adminnézet elkészült.
- PASS: mindhárom weboldali API-forrásba (napi menü, karácsonyi rendelés, kapcsolat/foglalás) bekerült a normalizált, szerveroldali Supabase-mentés **opt-in** illesztése, `ADMIN_DB_SYNC_ENABLED` flag mögött.
- PASS: az integrációs Vercel Preview build READY; a GitHub ág nem lett production ágra egyesítve.
- PASS: Preview tesztmód, teszt e-mail-irányítás és lezárt éles kapcsolat beállítva az új ágon. `ADMIN_DB_SYNC_ENABLED=false`.
- NOT VERIFIED: böngészős admin-belépés és API-val történő valódi adatlista; tesztrendelés weboldal → Supabase → admin.
- BLOCKED: a korábbi ügyfélteszt Preview-ághoz kötött e-mail webhookok értékeit a Vercel csatlakozó nem engedi dekódolni. Az eredeti secretnek egy második Preview-ághoz való hozzákapcsolása Vercel felületi jóváhagyást/beállítást igényel. A secretet nem másoltuk vaktában, és az eredeti tesztágat nem módosítottuk.
- RELEASE BLOCKER: sikertelen webhook után az adatbázisban már eltárolt kérés újrapróbálása duplikált rendelést eredményezhet. Stabil kliens oldali idempotencia-azonosító, adatbázisbeli egyediség, e-mail/outbox állapotkezelés és E2E szükséges **mielőtt a flag true lehet**.
- RELEASE BLOCKER: szuperadmin / iroda / pultos / futár külön fiók és soronkénti jogosultság nem készült el; a közös adminjelszó csak a tesztelhető olvasási nézethez használható.
- RELEASE BLOCKER: a prototípusban elfogadott kiszállítás- és pénzügyi lezárási UX, Google Táblázatok mentés még nincs éles API-val összekötve.
- RELEASE BLOCKER: a napi menü forrás végpontja jelenleg 2026. november 13-ig tartalmaz statikus ételsorokat. A későbbi hetekhez publikált adatbázis-menü és weboldali megjelenítés közös forrása szükséges.

Ne kapcsoljuk be az adatmentési flaget és ne vigyük productionra a PR-t a felsorolt ellenőrzések előtt.


## Integrációs tesztág – legutóbbi fejlesztés (2026-11-08 késő este)
- Kizárólag `feature/admin-integration-20261108` Vercel Preview környezet: `ADMIN_DB_SYNC_ENABLED=true` és `KASTELYDOMB_MODE=test`. Production változatlan.
- A jelenlegi, ügyfélteszten már meglévő három Zapier webhook URL-jének Preview-only másolata a Vercelben beállítva, az eredeti webhookok és Zaps módosítása nélkül. Napi menühook és aktiváló változó projekt Preview hatókörben létezik.
- A négy űrlap mostantól ismételt beküldéskor stabil `request_id` UUID-t használ; Supabase `on_conflict` + egyedi DB-index védi a duplikált rekordok ellen.
- `kastelydomb_notification_outbox` és `kd_claim_notification` RPC: at-most-once webhook-küldési **kísérlet** ugyanazzal az azonosítóval; bizonytalan hálózati eredmény `uncertain` és kézi ellenőrzést igényel. Ez önmagában nem igazolja a Zapier oldali egyszeri kézbesítést.
- SQL tesztek: menü- és karácsonyi táblában teszt-INSERT sikeres, ROLLBACK történt; notification claim ismétlése `review` választ adott, ROLLBACK történt.
- Vercel Preview új commitra `READY`. Browserbase teljes E2E futtatás szolgáltatói 402 keretkorlát, a Vercel futási logok lekérése 403 miatt nem volt elérhető. Teljes POST → Supabase → admin → Zapier végigteszt **NOT VERIFIED**.
- Az adatbázisban korábban lévő 10 teszt-menürendelés nincs törölve. Semmilyen törlés ne történjen az első élő integrációs teszt és az ügyfél jóváhagyása előtt.
- Éles indulás előtt: az összes tesztadat archiválása/mentése, kapcsolt payment/assignment/outbox rekordok függőségi sorrend szerinti törlése (csak `is_test=true`), új megrendelések `is_test=false` címkézésének igazolása, e-mail-BCC kivezetésének jóváhagyása és produkciós űrlapengedélyezés külön release gate.
