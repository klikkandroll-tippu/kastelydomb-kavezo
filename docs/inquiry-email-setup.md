# Kapcsolatfelvétel és asztalfoglalás – ellenőrzött átadás

**Ellenőrzés: 2026. október 31., Europe/Budapest. Állapot: működő tesztüzem.**

A korábbi Zapier-belépési akadály friss Google-hitelesítéssel megszűnt. A pontos eredeti ok nem bizonyított; az új belépés sikeres volt. A két külön automatizmus létrejött, a webhookok a Vercel tesztágához csatlakoznak, és a teljes webes beküldésből automatikusan megérkeztek a levelek.

## Működő elemek

| Elem | Ellenőrzött eredmény |
| --- | --- |
| Kapcsolatfelvételi űrlap → API → Zapier → Gmail | Sikeres böngészős beküldés, 2 beérkezett levél |
| Asztalfoglalási űrlap → API → Zapier → Gmail | Sikeres böngészős beküldés, 2 beérkezett levél; hajnali időponttal is újratesztelve |
| Éttermi értesítő és vendég visszaigazolása | Külön HTML-levelek mindkét űrlapnál |
| Arculat | #403328 barna, #f5f1e9 bézs, #faf7f0 világos panel, fehér tartalom, 600 px szélesség |
| Tesztcímzés | Minden levél kizárólag tippanzsolt@gmail.com, CC/BCC üres |
| Feladó | klikkandroll.ai@gmail.com; Kastélydomb Kávézó és Étterem – TESZT |
| Valódi vendégcím védelme | Az űrlapba nem-küldendő tesztcím került, mégis csak a kijelölt tesztcím kapott levelet |
| Foglalás jelentése | Csak az igény beérkezését igazolja; külön éttermi elfogadás kell |
| Nem tesztadat blokkolása | is_test=false esetén mindkét Zap futása Filtered, levélküldés nélkül |
| Automatizált kódellenőrzés | npm test: 24/24; npm run build és TypeScript: sikeres |
| Éles küldés és production kiadás | Nem aktiváltuk |

## Automatizmusok

| Zap | Azonosító | Állapot | Lépések |
| --- | --- | --- | --- |
| Kastélydomb – Kapcsolatfelvétel – TESZT | 385372469 | Bekapcsolva, csak tesztadatot fogad | Catch Hook → Filter → Gmail vendég → Gmail étterem |
| Kastélydomb – Asztalfoglalási igény – TESZT | 385372524 | Bekapcsolva, csak tesztadatot fogad | Catch Hook → Filter → Gmail étterem → Gmail vendég |

A szűrő mindkét Zapban AND kapcsolatot használ: is_test igaz és a megfelelő event. A kapcsolat eseménye contact.created; a foglalásé reservation.requested.

A két Gmail-lépésben fixen tippanzsolt@gmail.com szerepel. A vendég eredeti e-mailjét egyik címzettmező sem használja. A csoportos küldés ki van kapcsolva.

| Szerep | Tárgy mező | HTML-törzs mező |
| --- | --- | --- |
| Étterem | subject_restaurant | restaurant_html |
| Vendég | subject_guest | guest_html |

## Vercel és GitHub

Repository: klikkandroll-tippu/kastelydomb-kavezo.
Ág: fix/mobile-ux-20261031. A main ágra nem került módosítás.
A meglévő űrlapok és a /api/inquiries végpont maradtak a rendszer alapjai.

Csak preview célra, kizárólag a tesztágra beállítva:

- CONTACT_ZAPIER_WEBHOOK_URL: a kapcsolatfelvételi Zap saját Catch Hookja.
- RESERVATION_ZAPIER_WEBHOOK_URL: a foglalási Zap saját Catch Hookja.
- KASTELYDOMB_MODE=test.
- INQUIRY_LIVE_EMAILS_ENABLED=false.

A webhook-címeket szándékosan nem tartalmazza a dokumentum; azok a Vercel környezeti változóiban vannak.
A preview környezetben a szerver a projektmódtól függetlenül tesztcímzésre kényszerít.

Utolsó funkcionálisan tesztelt kódcommit: 482cc4734389a3d1c911bb46f1708e02256de10d.
Vercel deployment: dpl_5zSDkdRaUo2Rr3c3kwvgG7Ah4kDA, READY.
Tesztoldal: https://kastelydomb-kavezo-h5hynl49k-tippanzsolt-8580s-projects.vercel.app/
Foglalás: https://kastelydomb-kavezo-h5hynl49k-tippanzsolt-8580s-projects.vercel.app/asztalfoglalas

## Bizonyítékok a teljes folyamat tesztjéből

Kapcsolat: E2E-KAPCSOLAT-20261031-1641.
Igényazonosító: 7f86337c-4830-4901-9a09-bc528185a3df.

| Példány | Beérkezett Gmail üzenetazonosító |
| --- | --- |
| Éttermi | 1a1929dc8c9fd892 |
| Vendég | 1a1929dbf0bbcd70 |

Mindkét levél ugyanazt az igényazonosítót és tesztüzenetet tartalmazta. Az ékezetek és a HTML-érzékeny karakterek megfelelően jelentek meg a HTML-forrásban. A weboldal sikeres tesztküldést jelzett, az űrlap kiürült.

Foglalás újratesztelve: E2E-FOGLALAS-JAVITOTT-20261031.
Igényazonosító: e5fff033-8cdd-427c-bbe4-9ba20f39e05d.

| Példány | Beérkezett Gmail üzenetazonosító |
| --- | --- |
| Éttermi | 1a192a16e476067b |
| Vendég | 1a192a17866b90bc |

A kiválasztott nap 2026-11-06, időpontja másnap hajnal 02:30, létszám 2 fő. A levéltörzs helyes érkezési dátuma 2026-11-07, és a javítás után a tárgy is 2026-11-07 02:30. A vendéglevél külön éttermi visszaigazolást ír elő. A weboldal sikeres tesztküldést jelzett.

A Zapier futási naplóban mindkét folyamatnál Successful állapot szerepelt. Külön is_test=false próbánál mindkettő Filtered lett; a blokkolandó tárgyú levelekre a Gmail-keresés nem adott találatot.

## Még nem bekapcsolt, külön jóváhagyást igénylő működés

A kért tesztüzemi e-mailfolyamatból nincs fennmaradó technikai feladat.

Az éles weboldalra kiadás, a fenyocsaba@gmail.com éttermi cím aktiválása és a valódi vendégeknek történő küldés szándékosan nincs bekapcsolva. Ezek későbbi, külön jóváhagyott lépések. Az élesítéskor a jelenlegi, kizárólag tesztadatot fogadó Zap-szűrőket és a fix tesztcímzést is tudatosan át kell alakítani; pusztán a projektmód átállítása nem engedélyezi a valódi küldést.
