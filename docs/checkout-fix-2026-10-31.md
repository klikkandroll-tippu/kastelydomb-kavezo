# Rendelési összesítő javítása – 2026. október 31.

Az átvételi mód change eseménye ugyanabba az ágba került, mint az előfizetés módjának váltása, ezért minden kiválasztott mennyiséget nullázott. A javítás az átvételi mód módosításakor újrarajzolja a határidőket és a címmezőket, a kiválasztott tételek megtartásával.

Ellenőrzés: a korábbi HTML-en a böngészős regressziós teszt 15 hibával reprodukálta az esetet. A javított HTML-en 16/16 ellenőrzés sikeres: többnapos A/C rendelés, helyben/elvitel/kiszállítás váltása, kapcsolati és céges adatok, készpénz/kártya/átutalás, összesítő és végső adatellenőrzés, előfizetés nélküli C menü és leves szinkronja. A Next.js production build sikeres.

Teszt futtatása telepített Playwright és Chromium mellett:

```sh
node tests/checkout.browser.test.mjs
```

Egyedi Chromiumhoz `BROWSER_BIN`, egyedi Playwright modulhoz `PLAYWRIGHT_MODULE` környezeti változó használható. Opcionális első argumentumként megadható egy telepített oldal letöltött HTML-je is. A teszt elkülönített helyi oldalon fut, külső kéréseket tilt, rendelést nem küld.
