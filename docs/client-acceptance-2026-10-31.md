# Kastélydomb – működő ügyfélteszt, 2026. október 31.

## Átadható tesztoldal

https://kastelydomb-kavezo-git-fix-mo-da67f8-tippanzsolt-8580s-projects.vercel.app/

Ez a fix/mobile-ux-20261031 ág működő Preview környezete. Vercel-belépés nélkül elérhető; anonim HTTP-lekéréssel is ellenőrizve. A korábban megadott kastelydomb-kavezo.vercel.app cím továbbra is a külön main kiadást mutatja; ügyféltesztre a fenti címet kell használni.

Funkcionálisan végigtesztelt alkalmazáskód: 39148532efb57c1c07426b8a7e8adc4e309af4ce.
Ellenőrzött telepítés: https://kastelydomb-kavezo-ayu167n0n-tippanzsolt-8580s-projects.vercel.app/
Vercel: https://vercel.com/tippanzsolt-8580s-projects/kastelydomb-kavezo/EAy7sVE6JoTmHDdbcpGywdHxWDwY

## Bekapcsolt folyamatok

| Folyamat | Tényleges eredmény |
| --- | --- |
| Menüválasztás → rendelési API → valódi Supabase → Zapier → két Gmail | MENU-261031-962243DE; 4600 Ft; két nap, két C menü és két leves; sikeres tárolás és mindkét levél |
| Kapcsolatfelvételi űrlap → API → Zapier → két Gmail | ÜGYFÉLTESZT-VEGATVETEL-20261031; sikeres webes visszajelzés és mindkét levél |
| Asztalfoglalás → API → Zapier → két Gmail | 2026-11-06 19:00, 2 fő; sikeres webes visszajelzés és mindkét levél |

Éttermi címzett: fenyocsaba@gmail.com. Vendégpéldány: az űrlapon megadott cím; a végteszteknél tippanzsolt@gmail.com. Mindkét levél BCC-je tippanzsolt@gmail.com. Feladó: klikkandroll.ai@gmail.com, Kastélydomb névvel.

Az éttermi példányok címzettjét a beérkezett BCC-példány fejlécében és a Zapier sikeres küldési eredményében ellenőriztem. Az étterem külön postafiókját nem olvastam. A foglalás és a rendelés beérkezését automatikus levél igazolja; a végleges elfogadás külön éttermi művelet.

## E-mail-bizonyítékok

| Folyamat | Vendégpéldány Gmail ID | Éttermi példány beérkezett BCC-jének Gmail ID-ja |
| --- | --- | --- |
| Menürendelés – teljes automatikus beküldés | 1a19401bae0bed34 | 1a19401c37b6abc6 |
| Kapcsolatfelvétel | 1a193fc3601b4c12 | 1a193fc94b72fa8a |
| Asztalfoglalás | 1a193fcc2391ffb6 | 1a193fcbdbae2db3 |

A menülevelek HTML-jében az összes teljes ételnév (a vesszőket tartalmazó köretek is), a 4600 Ft-os összeg, az ügyfélteszt-jelölés és a QR-kód is ellenőrizve. A menüadatokat nem bontja szét külön Zapier-kód vesszők alapján: a szerver készíti a szerepnek megfelelő HTML-t.

## Automatizmusok

- Menü: 385365940, publikált v2: Ügyfélteszt – vendég és éttermi menülevél + BCC. Catch Hook → Gmail vendég → Gmail étterem. A korábbi két köztes kódlépés kivezetve; a Gmail a guest_html és restaurant_html webhookmezőket használja. A korábbi félkész éttermi példány most aktív.
- Kapcsolat: 385372469, bekapcsolva; két Gmail és tesztesemény-szűrés.
- Foglalás: 385372524, bekapcsolva; két Gmail és tesztesemény-szűrés.

A címzettellenőrzés a felhasználó által megadott pontos címeken alapult. A már működő Zapier-küldés mellett a menü API nem küld párhuzamos Resend-levelet.

## Kód és adatok

- A main aktuális november 2–6-i menütartalma és a checkout-javítás összevezetve a működő űrlap- és adminfejlesztéssel, a már létező tesztágon.
- A rendelési oldal indulásánál megszűnt az elavult, nem definiált WEEK változó és a nem létező második hétre mutató kezdő kiválasztás.
- Átvételi mód és fizetés váltásakor megmaradnak az ételek és az összeg.
- A vendéglevél miatt menürendelésnél minden fizetési módhoz e-mail-cím szükséges.
- A Supabase 2026-11-02 kezdetű, publikált teszthetén a próbaételnevek helyére a felhasználó által jóváhagyott november 2–6-i kínálat került. Az árakon nem változtattam. Adatbázisséma-módosítás nem történt.
- A tesztrendelések is_test=true jelöléssel megmaradnak; adatot nem töröltem.

## Ellenőrzések

- 28/28 automatizált szabályteszt.
- 30/30 helyi API-/admin-/böngészős ellenőrzés elkülönített tesztadatbázissal.
- 16/16 checkout-ellenőrzés valódi Chromiumban, helyi API-fixture mellett.
- Next.js production build és a módosított API-/routing-fájlok ESLint-ellenőrzése sikeres.
- A teljes repó ESLint-je két korábban meglévő, a karacsonyi-talak oldalon található next/link szabályhibát jelez. Ez a három most átadott űrlap működését nem érinti.
- A tényleges Vercel → Supabase/Zapier → Gmail folyamat mindhárom űrlappal sikeres; ez nem pusztán build-ellenőrzés.

## Tesztüzemi határ

A tesztoldal küld és tárol: nem bemutató. Valódi kiszállítás és fizetés nem történik; a levelek és a weboldal tesztjelölést kapnak. Az online bankkártyás fizetés és a Számlázz.hu a korábbi döntés szerinti későbbi integráció, nem része ennek a működő e-mailes ügyféltesztnek. A Resend-domain DNS-hitelesítése továbbra sem kész; az átadott értesítések a működő Gmail/Zapier útvonalon mennek.

A tesztadatok törlése és a tényleges üzemi indulás az ügyfélteszt elfogadása után következik. A végső üzemi domain átállítása most nem történt meg.
