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
