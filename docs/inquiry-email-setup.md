# Kapcsolatfelvétel és asztalfoglalás – e-mailes értesítések

Dátum: 2026. október 31. Kizárólag tesztüzem. Az éles küldés nincs engedélyezve.

## Meglévő alap és változások

Repository: klikkandroll-tippu/kastelydomb-kavezo. Tesztág: fix/mobile-ux-20261031.
A meglévő két űrlap és a `src/app/api/inquiries/route.ts` végpont megmaradt.
A jóváhagyott napi menüs levélből Gmailben ellenőrzött színek: barna #403328,
bézs #f5f1e9, világos panel #faf7f0, fehér tartalom, legfeljebb 600 px szélesség.
Mindkét űrlap két külön HTML-t állít elő: éttermi értesítés és vendég beérkezési visszaigazolás.
Az asztalfoglalás csak külön éttermi visszaigazolás után végleges.

A folytatásban javítva: JSON-alak és tényleges méret ellenőrzése; érvénytelen vagy elmúlt
foglalási nap; hibás perc/óra és tört létszám; másnap hajnali időpont közérthető megjelenítése;
igényazonosító; TESZT tárgy és figyelmeztetés. A státuszvégpont az éles küldési tiltást is figyelembe veszi.
A Vercel preview környezet mindig tesztcímzést használ, akkor is, ha a projekt módját tévesen productionre állítják.

## Két létrehozandó Zap

Nem jöttek létre ebben a munkamenetben: a kapcsolt Zapier Manager nem támogat Zap/lépés létrehozást,
a böngészős Google-belépés pedig a Zapier visszatérési oldalán hibát adott:
`Zapier could not connect to your account. Need code, state and a cached state.`
Friss Zapier-oldalon sem volt bejelentkezett munkamenet.

1. **Kastélydomb – Kapcsolatfelvétel – TESZT**
2. **Kastélydomb – Asztalfoglalási igény – TESZT**

Mindkét Zap lépései:

1. Webhooks by Zapier → Catch Hook. Külön webhook a két űrlapnak.
2. Filter: `is_test` igaz és `event` rendre `contact.created` vagy `reservation.requested`.
3. Gmail → Send Email, éttermi példány.
4. Gmail → Send Email, vendégpéldány.

Gmail-feladó kapcsolat: **klikkandroll.ai@gmail.com**, név: Kastélydomb Kávézó és Étterem – TESZT.
Nem az alapértelmezett, más ügyfélhez tartozó Gmail-kapcsolatot kell használni.

| Gmail-mező | Éttermi lépés | Vendéglépés |
| --- | --- | --- |
| To tesztüzemben | fix tippanzsolt@gmail.com | fix tippanzsolt@gmail.com |
| Subject | subject_restaurant | subject_guest |
| Body type | HTML | HTML |
| Body | restaurant_html | guest_html |
| CC / BCC | üres | üres |
| Csoportos küldés | kikapcsolva | kikapcsolva |

A tesztben a címzettet fixen kell beírni; az eredeti vendég e-mailjét tilos a To/CC/BCC mezőhöz rendelni.
A végleges éttermi cím fenyocsaba@gmail.com, de ebben a fázisban oda sem küldünk.
A napi menürendelési és a karácsonyi Zap külön folyamat, nem helyettesíti a két új automatizmust.

## Vercel bekötés – a webhookok létrehozása után

Csak a **preview** célra és a **fix/mobile-ux-20261031** ágra:

| Változó | Érték |
| --- | --- |
| CONTACT_ZAPIER_WEBHOOK_URL | az új kapcsolatfelvételi Catch Hook URL |
| RESERVATION_ZAPIER_WEBHOOK_URL | az új foglalási Catch Hook URL |
| KASTELYDOMB_MODE | test |
| INQUIRY_LIVE_EMAILS_ENABLED | false |

Valós webhook helyett helykitöltőt nem szabad beállítani. Production változóhoz nem nyúlunk.
Beállítás után új preview telepítés szükséges. A POST-válasz `ok:true` csak a webhook átvételét igazolja;
a Gmail-kézbesítést külön beérkezett levelekkel és Zap Historyval kell igazolni.

## Ellenőrzések és folytatás

`npm test`: 24/24 sikeres, ebből 9 értesítési teszteset. `npm run build`: sikeres, TypeScript is hibamentes.
A webhook-próbák a tesztkészletben helyettesített hálózati hívást használnak, nem bizonyítanak Zap-futást.

Négy külön HTML-küldési próba ment Zapier MCP → Gmail útvonalon a meglévő végpont által előállított tartalommal:
kapcsolatfelvétel éttermi/vendég és foglalás éttermi/vendég. Címzett kizárólag tippanzsolt@gmail.com.
Ezek komponenspróbák, nem teljes webes automatizmustesztek.

Hátravan a belépési akadály feloldása, a két Zap létrehozása és mezőtérképezése,
az új webhookok preview-ágra állítása, majd mindkét űrlap tényleges beküldése és négy beérkezett levél visszaellenőrzése.
Az éles küldés aktiválása és a production kiadás nincs engedélyezve.
