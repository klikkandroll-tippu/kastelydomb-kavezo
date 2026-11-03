# Kastélydomb – ügyfélteszt kiadási rend (2026-11-03)

## Egyesített kiadás
- Jelölt ág: `fix/ugyfelteszt-egyseges-20261103`.
- Alap: `feature/ajanlatok-karacsony-20261101` (Ajánlatok és karácsonyi rendelés megőrzése).
- Átemelve a `fix/mobile-ux-20261031` ágból: kapcsolatfelvételi űrlap, asztalfoglalási űrlap, `/api/inquiries`, e-mail-címzés; az Ajánlatok navigáció helyreállítva asztali és mobilnézetben.
- Vercel: `kastelydomb-kavezo` projekt, új preview deployment, a `READY` állapot önmagában **nem bizonyítja** a funkcionális működést.
- Az ágspecifikus tesztkörnyezeti webhookok és teszt-email mód az egyesített ághoz is beállítva.

## Kiadási kapu (mindegyik PASS kell)
1. Asztali és mobil navigáció: Főoldal, Napi menü, Ajánlatok, Karácsonyi rendelés, Asztalfoglalás, Kapcsolat, Étlap.
2. Kapcsolat: adatvédelmi checkbox bepipálható; beküldés sikeres; vendég- és éttermi e-mail beérkezik.
3. Foglalás: adatvédelmi checkbox bepipálható; beküldés sikeres; mindkét e-mail beérkezik; foglalási igény nem automatikus foglalási visszaigazolás.
4. Napi menü: választás, mennyiség, átvétel, fizetés, összesítés, sikeres elküldés, kétoldali e-mail.
5. Karácsonyi ajánlat: minden étel, salátánként min. 5 adag, 2026-12-24, szállítási cím, összesítés, sikeres beküldés, kétoldali e-mail.
6. Minden értesítés ellenőrzése a vendég választott címén és `fenyocsaba@gmail.com` címen, teszt BCC a beállítás szerint.
7. Tesztrendeléseket a valódi rendelésektől elkülöníteni; sikeres teszt után adattisztítás.
8. Csak PASS után válhat ez a tesztág a központi fejlesztési alappá; a kiválasztott commit SHA és stabil teszt URL rögzítendő.

## Szabály a további fejlesztéshez
Egyetlen kijelölt integrációs ág és egyetlen partnernek kiadott stabil preview link. Új funkció külön rövid életű ágon készülhet, de csak visszatesztelt integráció után kerül az ügyféltesztbe. Régi preview/commit linket kiadásra tilos használni. A production domain nem módosítható pusztán sikeres build alapján.

## Nyitott korlát
2026-11-03: a Vercel build READY, de a teljes böngészős E2E és a tényleges levélkézbesítés még nincs igazolva. Nem kiadható teljesen teszteltként.
