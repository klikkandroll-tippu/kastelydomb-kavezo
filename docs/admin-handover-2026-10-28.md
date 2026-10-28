# Kastélydomb Kávézó és Étterem – adminisztrációs rendszer átadása

Dátum: 2026. október 28., Europe/Budapest.

**Státusz: a hiányzó adminmodulok implementálva, helyben és az adatbázison tesztelve. Az éles üzembe helyezés nincs kész.** A Vercel-előnézet és a valódi Supabase közötti teljes folyamatot a jelenlegi Vercel-hozzáférés 403-as hibája miatt nem lehetett igazolni. A `main` ág és az éles weboldal nem lett módosítva. Az éles adatbázison visszafelé kompatibilis, hozzáadó migrációk futottak le.

## 1. Hivatkozások

- [GitHub projekt](https://github.com/klikkandroll-tippu/kastelydomb-kavezo)
- [Fejlesztési ág](https://github.com/klikkandroll-tippu/kastelydomb-kavezo/tree/feature/menu-order-admin-20261027)
- [Pull request #2](https://github.com/klikkandroll-tippu/kastelydomb-kavezo/pull/2)
- [Vercel projekt](https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo)
- [Vercel Preview](https://kastelydomb-kavezo-git-featur-2f070b-tippanzsolt-8580s-projects.vercel.app)
- [Admin az előnézetben](https://kastelydomb-kavezo-git-featur-2f070b-tippanzsolt-8580s-projects.vercel.app/admin)
- [Supabase projekt](https://supabase.com/dashboard/project/snxlismmgzwpxerenwsv)
- [Telepítési és üzemeltetési útmutató](admin-setup.md)

A tesztelt alkalmazáskód commitja: [`50dbb3c39d9952d7457df5f61e978d9b1d0a1dce`](https://github.com/klikkandroll-tippu/kastelydomb-kavezo/commit/50dbb3c39d9952d7457df5f61e978d9b1d0a1dce). Ehhez a GitHubon jelzett Vercel-ellenőrzés **success**, a telepítés [itt érhető el](https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo/FT77T2ZUW4rAVGLVuvVJSw3dTSys). Ez buildbizonyíték, nem teljes működési igazolás. A PR nyitott tervezet, konfliktus nélkül integrálható. A `main` ellenőrzött fejcommitja továbbra is `6a4386b854585f77cf434d3780492068de4f8a68`; nem változott. Az ezt követő jelentésfrissítés csak dokumentációt módosít.

## 2. Elkészült funkciók

| Modul | Megvalósított működés | Ellenőrzés |
| --- | --- | --- |
| Adminbelépés | Szerveroldali jelszóellenőrzés; lejáró, visszavonható munkamenet; HttpOnly/Secure/Strict süti; belépési korlát; módosító kérések eredetellenőrzése | Helyi valódi Next API és böngésző; DB-jogosultságok ellenőrzése |
| Rendelések | Valós adatlista, keresés, állapotszűrő, részletek, nyomtatható rendeléslap, szerveroldali állapotváltás | Böngészőben adatbetöltés; állapotműveletek valódi DB-tranzakcióban |
| Futárok | Létrehozás, szerkesztés, aktív/inaktív állapot, telefon, terület | Böngészős létrehozás; DB-függvény teszt |
| Kiszállítás | Aktív futár hozzárendelése rendeléshez; hozzárendelés ellenőrzése befizetéskor és teljesítéskor | Böngésző/API és DB-teszt |
| Fizetések | Rész- és teljes befizetés, készpénz/kártya/céges átutalás, átvevő, napló, automatikus egyenleg | Böngészős részfizetés; valódi DB-n rész/teljes fizetés, duplikáció- és túlfizetés-tiltás |
| Kintlévőségek | Tényleges befizetésből számolt fennmaradó összeg | Böngészős befizetési folyamat és egyenleglogika |
| Futárelszámolás | Időszak lezárása, készpénz/kártya/hátralék/rendelésszám; átfedés tiltása | Valódi DB-tranzakció; a felület betöltése mobilon |
| Heti menü | Öt hétköznap szerkesztése, piszkozat/publikálás, bekötés a meglévő menürendelőbe | Böngészős mentés és publikálás; nyilvános API és vendégoldali megjelenés |
| Ügyfelek | Telefon/e-mail szerint összesített névjegyzék, céges számlázási adatok, rendelések, hátralék | Böngészős megjelenítés |
| Riport | Dátumszűrés, összeg/befizetés/hátralék, CSV-export és nyomtatási művelet | Böngészős CSV-letöltés; dátumhatár-tesztek |
| Rendelésbeküldés | Szerveroldali ár- és szabályellenőrzés; céges adatok tárolása; pontos levesadagszám; ismételt küldés védelme | Helyi Next → tesztadatbázis API-folyamat; negatív tesztek |
| Reszponzív felület | Meglévő sötétbarna oldalsáv és világos munkatér; teljes szélesség; mobilmenü; vízszintesen görgethető táblák | 1440 px és 390 px Chromium, képi ellenőrzéssel |

Az üzleti felületeken nincs beégetett mintarendelés. A tesztkiszolgálóban szereplő szintetikus adatok nem kerültek az éles adatbázisba.

## 3. Tesztbizonyíték és annak határai

- `npm test`: **10/10 sikeres** – budapesti 09:00/14:30 határidők, téli/nyári időszámítás, múlt/jövő, napi/heti/havi jelentési dátumhatárok, menüstruktúra.
- `npm run lint`: **sikeres, 0 hiba**.
- `npm run build`: **sikeres**, a TypeScript-ellenőrzéssel együtt.
- `npm run test:e2e`: **26/26 sikeres** – jogosulatlan olvasás, más eredetű belépés, hibás jelszó, biztonságos süti, kijelentkezés, közvetlen fizetett-állapot átírásának tiltása, hibás befizetés, belépés, futárkezelés, hozzárendelés, részfizetés, ügyfélnézet, CSV, menüpublikálás, vendégoldali megjelenés, rendelésár, levesmennyiség, duplikált küldés, mobilnavigáció, valamint tiltott rendelési kombinációk.
- `tests/database-workflows.sql`: **sikeres a valódi Supabase projekten**, `service_role` jogosultsággal; rész-/teljes fizetés, idempotencia, túlfizetés tiltása, befizetett rendelés lemondásának tiltása, hozzárendelés, teljesítés, elszámolás, átfedés, sebességkorlát és szerepkör-korlátozások.
- A DB-teszt tranzakciója `ROLLBACK`-kel zárult. Nem maradt benne tesztrendelés, tesztfutár vagy tesztbefizetés.
- Böngésző: Chromium; 1440×1000 és 390×844 nézet. Nincs böngészős JavaScript-hiba, a mobiloldal nem lóg túl a képernyőn.

**Lényeges különbség:** a böngészős E2E a valódi alkalmazást egy elkülönített PostgREST tesztkiszolgálóval futtatja. A pénzügyi SQL-függvények külön, a valódi Supabase-en lettek ellenőrizve. A telepített Vercel-környezet, annak titkos változói, a Supabase Data API-ja és az admin együttes működése még nincs végponttól végpontig igazolva.

## 4. Adatbázis-módosítások

Projektazonosító: `snxlismmgzwpxerenwsv`. A Kastélydomb-táblák és migrációs előzmények egyértelműen azonosították; más ügyfél adatbázisa nem lett módosítva.

Alkalmazott migrációk ebben a munkában:

| Verzió | Név |
| --- | --- |
| `20261028012242` | `kastelydomb_admin_workflows` |
| `20261028012439` | `kastelydomb_order_request_fingerprint` |

Új táblák: `kastelydomb_admin_sessions`, `kastelydomb_rate_limits`, `kastelydomb_audit`.

Új mezők: rendeléshez `company_address`, `tax_number`, `request_fingerprint`; befizetéshez egyedi `request_id`.

Új szerveroldali függvények: `kd_rate_limit`, `kd_driver`, `kd_assign`, `kd_payment`, `kd_order_status`, `kd_settle`, `kd_menu`. A pénzügyi és kapcsolódó rendelési műveletek tranzakciós zárolással futnak. Az üzleti változás és az auditbejegyzés együtt mentődik.

Mind a kilenc alkalmazástáblán RLS aktív. Az admin RPC-k végrehajtása csak a szerveroldali `service_role` szerepkörnek engedélyezett. A meglévő `rls_auto_enable()` függvény nyilvános végrehajtási jogait visszavontam. A biztonsági ellenőrzés ezt követően csak a szándékos, policy nélküli RLS-t jelző INFO-kat adta; WARN/ERROR nem maradt. [Az INFO magyarázata](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

A teljesítmény-ellenőrzés a frissen létrehozott, üres táblák még nem használt indexeit jelezte INFO-ként; a szükséges indexek megmaradtak.

## 5. Javított hibák és akadályok

- A külön menüpontok mögött ismétlődő rendeléslista helyére tényleges funkciók kerültek.
- A minden kérésnél újraküldött adminjelszót szerveroldali munkamenet váltotta fel.
- A fizetett státusz közvetlen átírása helyett befizetési eseményekből számolt állapot és hátralék működik.
- A nyilvános rendelő régi, fix dátumhoz kötött menüláthatósága dinamikus lett.
- A leves korábbi, fogásonként ismétlődő szövegadata helyett külön, pontos adagszám tárolódik.
- A céges cím és adószám korábban nem jutott el a tárolásig; most eljut és szerveroldalon ellenőrzött.
- A globális `.shell` CSS-szabály korlátozta az admin szélességét. Ezt az adminon belül felülírtam, a meglévő koncepció megtartásával.
- A helyi Next-indítás hálózati interfész-felderítési hibáját explicit localhost-kötéssel oldottam meg. A böngészőtesztben szabványos Chromium-telepítés helyett helyi alternatív bináris kellett; a teszt nem igényel hálózati védelmek kikapcsolását.
- A GitHub parancssori pushhoz nem volt hitelesítés; a kapcsolt GitHub-integrációval mentettem az ágat. Az éles ág nem változott.
- **Nyitott akadály:** a Vercel telepítéslista és a védett Preview lekérése is 403. A támogatott CLI-alternatívában nincs aktív hitelesítés. Nem kapcsoltam ki a Vercel-védelmet, nem olvastam ki titkos környezeti változót és nem kerültem meg a jogosultságot.

## 6. Fennmaradó hiányok és üzleti korlátok

1. **Telepített rendszer teljes tesztje és élesítés:** a Vercel-jogosultság helyreállításáig nyitott.
2. **Online bankkártya és Számlázz.hu:** a korábbi jóváhagyás szerint későbbi integráció; most nem részei a működő rendszernek.
3. **Visszatérítés, befizetés-visszavonás, lezárt elszámolás korrekciója:** nincs hozzá könyvelési munkafolyamat. Befizetett rendelés lemondását ezért a rendszer megállítja.
4. **Többnapos rendelés napi diszpécselése:** a jelenlegi adatmodell rendelésenként egy futár-hozzárendelést és egy teljesítési állapotot kezel. Naponta más futár vagy napokra bontott teljesítés külön fejlesztés.
5. **Ügyfél-CRM:** a névjegyzék rendelési adatokból képzett nézet; önálló ügyféltörzs-szerkesztés és telefonos rendelés kézi felvitele nincs.
6. **Ünnepnapi és módosítható árak:** a meglévő standard árképzés maradt meg. Ünnepnapi eltérő árhoz külön jóváhagyott szabály kell; automatikus publikálása tiltott.
7. **Egyéni adminfiókok és szerepkörök:** közös adminjelszavas belépés működik, személyenkénti jogosultságkezelés nincs. Az audit ezért műveletet és érintett rekordot naplóz, nem személyhez kötött operátori azonosítót.
8. **Automatikus rendelési e-mail és személyesadat-megőrzési automatika:** nincs bekötve. A rendelő nem ígér nem létező automatikus utalási e-mailt. Az adatkezelési megőrzési rendet indulás előtt rendezni kell.
9. **Nagy adatmennyiség archívuma:** a 10 000 soros védőkorláton túli szerveroldali archívumszűrés külön feladat.

Ezek miatt a rendszert nem minősítem teljes körűen kész, éles használatra átadott projektnek.

## 7. Pontos következő lépések

### Felhasználói teendő

A Vercel-kapcsolatban engedélyezni kell a **tippanzsolt-8580s-projects** csapatot és a **kastelydomb-kavezo** projektet. A kapcsolt Vercel-fióknak is hozzá kell férnie ezekhez. Ezt a jogosultságot a jelenlegi kapcsolattal nem tudtam helyreállítani. Jelszót vagy kulcsot ne küldjön a beszélgetésbe.

Üzletileg ellenőrizendő az aktuális heti menü, a standard árak, a rendelési határidők, az induló futáradatok és az adatmegőrzési rend. Az adatbázisban nincs automatikusan élesített mintamenü.

### Technikai folytatás a hozzáférés rendezése után

1. A legfrissebb fejlesztési commit Preview telepítésének azonosítása; a környezeti változók meglétének ellenőrzése titokértékek kiolvasása nélkül.
2. A Preview és az elkülönített tesztadatokkal használt valódi Supabase összekötésének ellenőrzése. A nyilvános production rendeléskapcsoló maradjon kikapcsolva.
3. Tényleges belépés/kilépés; hibás belépési korlát; menü mentése/publikálása; vendégoldali rendelés; adminban megjelenés; futár-hozzárendelés; rész- és teljes befizetés; teljesítés; lezárt napi elszámolás; CSV és nyomtatási nézet ellenőrzése.
4. A tesztrendelések, befizetések és elszámolások tiszta, elkülönített tesztkörnyezetben maradjanak. Éles adatot ne kelljen teszt céljából módosítani vagy törölni.
5. Az eredmények commitazonosítóval történő dokumentálása után a PR integrálása a `main` ágba és kontrollált production telepítés.
6. Production ellenőrzés még kikapcsolt rendelésfogadással; majd az elfogadott aktuális menü és árak ellenőrzése után `ORDER_INTAKE_ENABLED=true`, újratelepítés és indulási ellenőrzés.
7. Hiba esetén az előző ismert jó Vercel-telepítés visszaállítása és a rendelésfogadás kikapcsolása. A hozzáadó adatbázis-migrációkat nem szükséges adatvesztéssel visszabontani.
