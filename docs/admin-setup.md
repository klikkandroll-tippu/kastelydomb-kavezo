# Kastélydomb menürendelési admin – telepítési útmutató

## Elkészült
- /admin: jelszóval védett, mobilon is használható kezelőfelület
- Rendeléslista, keresés, státuszszűrő, összesítő, részletek, nyomtatás
- Rendelés- és fizetési állapot módosítása a szerveroldali API-n keresztül
- Nincs Számlázz.hu és nincs online fizetési integráció

## Kötelező élesítési feladatok
1. Hozzon létre a Kastélydomb számára elkülönített Supabase projektet (ne osszon meg adatbázist más ügyfelekkel).
2. Futtassa a database/kastelydomb_orders.sql sémát és ellenőrizze az RLS-t.
3. Állítsa be Vercelben, kizárólag szerveroldalon: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD_SHA256.
4. Az ADMIN_PASSWORD_SHA256 egy hosszú, egyedi adminjelszó UTF-8 SHA-256 hex kivonata. Soha ne tároljon jelszót vagy service-role kulcsot a GitHubon.
5. Módosítsa a nyilvános napi menürendelőt: a rendelés leadásakor biztonságos backend végpont mentse az adatokat az adatbázisba, a teljes összeget szerveroldalon újraszámolva. A jelenlegi HTML-rendelő még nem kapcsolódik ehhez.
6. Az adminhoz élesítés előtt szükséges: belépésvédelem / rate limit / auditnapló, rendelésbeküldési abuse védelem, GDPR adatkezelési életciklus, szerveroldali rendelésszabály-ellenőrzés és végpont-végpont teszt.
7. Átvételkori készpénz/bankkártya és céges átutalás lehetséges, az online kártyás fizetés bekötése későbbi fázis.

A felület a beállítások hiányában 503 hibával jelez, nem mutat fiktív éles rendeléseket.
