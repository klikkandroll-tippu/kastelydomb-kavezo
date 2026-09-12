# Kastélydomb Kávézó és Étterem — weboldaltervezet

Modern, egyoldalas Next.js weboldal a Kastélydomb Kávézó és Étterem számára. A projekt GitHub–Vercel munkafolyamathoz készült.

## Fejlesztés

```bash
npm install
npm run dev
```

Minőségellenőrzés:

```bash
npm run lint
npm run build
```

## Arculati alapszínek

- Logóarany: `#D3B25D`
- Homok: `#E4C982`
- Márkapiros: `#D51F32`
- Logópiros: `#E62030`
- Világos barna: `#9D745C`
- Sötét barna: `#4A2F25`
- Mélybarna: `#241711`
- Törtfehér: `#F7F1E5`
- Fehér: `#FFFDF9`

## Tartalmi és képforrások

- Hivatalos weboldal: <https://kastelydombkavezo.hu/>
- Hivatalos Facebook-oldal: <https://www.facebook.com/Kastelydombkavezo/>
- Hivatalos Wolt-étteremoldal: <https://wolt.com/hu/hun/varpalota/restaurant/kastlydomb-kavezo-es-etterem>
- Foodora-étteremoldal: <https://www.foodora.hu/en/restaurant/rvoz/kastelydomb-kavezo-es-etterem>

A `public/images` mappában lévő éttermi, rendezvény- és esküvői fotók a Kastélydomb nyilvános hivatalos felületeiről származnak. Publikálás előtt a megrendelői felhasználási jóváhagyást célszerű dokumentálni.

## Szerkesztési megjegyzések

- A heti menü és az eseményblokk jelenleg tartalmi mintát tartalmaz; élesítés előtt aktuális adatokkal töltendő.
- A kapcsolatfelvételi űrlap tervezeti bemutató módban működik. Éles küldéshez e-mail-szolgáltatás vagy saját API-végpont szükséges.
- A szolgáltatáskártyák később külön landing oldalakra köthetők.
