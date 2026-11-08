# Kastélydomb Admin – V1.3 referencia és integrációs funkciólista

## Végleges vizuális referencia
- **Elfogadott admin UI: V1.3.** Az átadott HTML-fájl neve történetileg `kastelydomb-admin-prototipus-v1-4.html`, de a ténylegesen jóváhagyott képernyő és belső verzió **V1.3**.
- **Változatlan eredeti forrás:** `src/admin/reference-v1.3-approved.html`.
- **Integrációs nézet:** `src/lib/approved-admin-html.ts`, hozzáférés-védetten a `/api/admin/shell` útvonalon; `/admin` kezeli a bejelentkezést. Nem a korábbi, eltérő React/Next dashboardot használjuk.
- Jelölés: `V1.3 · Integrációs teszt folyamatban`.
- A jóváhagyott bal oldali világos menü, ikonok, kezdőlap, kártyák, modális részletezők, szűrők és nyomtatási megjelenés az eredeti HTML-ből származnak.

## Teljes ellenőrzött funkcióleltár

| Terület | V1.3-ban szereplő nézet / művelet | Integráció állapota |
|---|---|---|
| Kezdőlap | 5 információs kártya, napi áttekintés | Supabase-adatokból számol; kézi Frissítés |
| Napi menü | Aktuális rendelések, dátumszűrők, korábbi/archivált rendelések | Supabase olvasás aktív |
| Napi menü | Mai nap és napi tétellista | Supabase JSON tételekből |
| Napi menü | Konyhai összesítő napokra és időszakra, leves | Supabase adatokból; egyedi árazási QA még szükséges |
| Napi menü | Futárlista | Supabase rendelésből épül; napi státuszmentés aktív külön ledgerrel |
| Napi menü | Rendelés részletei, QR, megerősítés és megjegyzés | QR-részletezés, megerősítés és megjegyzésmentés fejlesztési ágon; böngészős E2E hiányzik |
| Rendelések | Párhuzamos ajánlatok; ajánlaton belül rendelés / konyha / kiszállítás | Karácsony ajánlata bekötve, további ajánlatok külön modellje hiányzik |
| Rendelések | Termékek, teljes összeg, fizetés | Felület visszaállítva, pénzügyi lezárás még letiltva |
| Kiszállítás | Aznapi futárfeladatok, cím és Google Maps | Nézet működő adatból, státusz és elszámolás fejlesztendő |
| Kiszállítás | Teljesítés, pénzbeszedés és pultos zárás | Tesztágon idempotens, napi státuszlépések és pontos összegellenőrzés; **élesítéshez szerepkörvédelem még hiányzik** |
| Kiszállítás | Napi futárelszámolás, készpénz / bankkártya | Kód szinten napi ár- és státusz-adatokból számol; régi tesztrendelésnél pénzbeszedés letiltva, éles pénzügyi egyeztetés szükséges |
| Asztalfoglalások | Lista, időpont, létszám, részletek, visszaigazolás | Supabase adatokból, AF kóddal; státusz mentési végpont aktív |
| Kapcsolatfelvétel | Lista, részletek, feldolgozás | Supabase adatokból, KF kóddal; megerősítés mentése aktív |
| Ügyfelek | Rendelők, foglalók, érdeklődők | Supabase adatokból összesítve |
| Beállítások | Szuperadmin / iroda / pultos / egy futár menüjogai | **UI-bemutató**; szerveroldali, személyenkénti szerepkörrendszer nincs élesítve |
| Export | Google táblázatba mentés címkéjű gomb | Az eredeti prototípus CSV-t generál, nem közvetlen Google Sheets mentést |
| Nyomtatás | Aktuális lista / konyhai összesítő | Eredeti prototípus nyomtatási nézete |
| Kódok | KF és AF: dátum + napi sorszám | Szerveroldali kiosztás, tesztelt |
| QR azonosító | Napi menü / karácsonyi rendelés | Napi menü: `KASTELYDOMB:MENU:<UUID>`; Karácsony: `KD-KAR-<8 hex>`, az e-mail QR-kódjának forrása |
| E-mailek | Vendég és étterem értesítése | Meglévő Zapier webhookokat nem cseréltük le |

## Élesítés / ügyfélteszt kapu
1. Teljes, személyenkénti szerveroldali jogosultságkezelés, pultos és futár külön hozzáféréssel.
2. Pontos napi pénzügyi bontás, futár beszedés és pultos elszámolás konzisztens adatbázis-írása.
3. Google Sheets közvetlen mentés beállítása és hitelesítése, vagy az ügyféllel külön jóváhagyott CSV-eljárás.
4. Belső adatmentés, tesztadatok elkülönítése, összes nézet böngészős regressziós ellenőrzése.
5. Weboldal → Supabase → admin → változatlan Zapier e-mail; QR azonosító megfelelés legalább 1 menü és 1 karácsonyi teszttel.
6. **Productionhoz és az eredeti elfogadott HTML-hez nem nyúlunk**, amíg minden szükséges pont nem PASS.

## Megjegyzés
A `READY` Vercel-deploy a build sikerét jelenti, önmagában nem teljes működésigazolás.

## További változások és ellenőrzések
- A napi menü API új rendelései már napra és tételre pontos `line_total_huf` mezőt tárolnak. A régi sorok változatlanok, áruk csak tájékoztatóan osztható fel, ezért a futár pénzbeszedési művelete azokon blokkolt.
- A `kastelydomb_delivery_progress` tábla és `kd_delivery_step` RPC megőrzi a napi teljesítés / pénzbeszedés / pultos elszámolás dátumát és a készpénz/kártya összeget.
- A dátumonkénti pénzbeszedés adatbázis-szinten csak a pontos napi összeggel és megfelelő fizetési móddal lehetséges; előre fizetett rendelések nem szedhetők be újra.
- SQL teszt szintetikus rendelésen: delivered → collected → settled, 2 800 Ft; **PASS**, ROLLBACK után semmi tesztadat nem maradt.
- Vercel READY és GitHub Actions Next-build PASS; teljes böngészős E2E még nem igazolt.
- A különböző felhasználókhoz tartozó **szerveroldali** jogosultság és a Google Sheets közvetlen API-mentés továbbra is kiadási blokkoló.
