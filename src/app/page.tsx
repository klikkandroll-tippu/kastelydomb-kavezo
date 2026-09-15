import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContactForm } from "./contact-form";

const services = [
  { icon: "restaurant", name: "Étterem à la carte", title: "Kulináris pillanatok: dőljön hátra, a többit bízza ránk.", text: "Várjuk egy kötetlen családi ebédre, egy fontos üzleti találkozóra vagy egy meghitt, kettesben eltöltött vacsorára. Válasszon gondosan összeállított étlapunkról, adja át magát a nyugalomnak, mi pedig gondoskodunk a tökéletes vendégélményről.", cta: "Asztalfoglalás", href: "/asztalfoglalas" },
  { icon: "public", name: "Közétkeztetés", title: "Kiszámítható minőség, kompromisszumok nélkül.", text: "Intézmények és szervezetek számára nyújtunk megbízható és magas színvonalú étkezési megoldásokat. Hiszünk abban, hogy a nagy volumen mellett is tartható a nívó: jól szervezett hátterünkkel alkalmazkodunk partnereink egyedi igényeihez.", cta: "Konzultáció", href: "#erdeklodes" },
  { icon: "events", name: "Családi és céges rendezvények", title: "Mérföldkövek méltó környezetben, szervezési terhek nélkül.", text: "Születésnap, évforduló, ballagás, osztálytalálkozó vagy egy évzáró céges vacsora? Bármit is ünnepelnek, levesszük a szervezés terhét a válláról, hogy Önnek és vendégeinek csak az élmény maradjon. A menüt és a vendéglátást maximálisan az esemény jellegéhez igazítjuk.", cta: "Kapcsolatfelvétel", href: "#erdeklodes" },
  { icon: "catering", name: "Catering", title: "A Kastélydomb minősége az Ön által választott helyszínen.", text: "A tökéletes vendéglátás nem ismer határokat. Professzionális catering szolgáltatásunkkal külső helyszínekre is elvisszük a tőlünk megszokott prémium minőséget és figyelmes szervizt, legyen szó akár egy elegáns állófogadásról, akár egy kötetlen családi rendezvényről.", cta: "Árajánlatkérés", href: "#erdeklodes" },
  { icon: "wedding", name: "Esküvő", title: "Az Önök nagy napja, a mi évtizedes szakértelmünk.", text: "Életük legfontosabb napján minden apró részlet számít. A Kastélydomb csapata az esküvői vendéglátás megtervezésétől a hajnalig tartó profi kiszolgálásig ott áll Önök mellett. Helyszínünket és menüinket úgy alakítjuk ki, hogy az a nap valóban csakis Önökről szóljon.", cta: "Egyedi ajánlat", href: "#erdeklodes" },
];

function ServiceIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    restaurant: <><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" /></>,
    public: <><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01" /></>,
    events: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 5v1" /></>,
    catering: <><path d="M4 16h16M6 16a6 6 0 0 1 12 0M12 8V5M10 5h4M3 20h18" /></>,
    wedding: <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /><path d="m7 5 2-2 2 2M13 5l2-2 2 2" /></>,
  };
  return <span className="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}

function Logo({ footer = false }: { footer?: boolean }) {
  return <Image className={footer ? "logo logo--footer" : "logo"} src="/images/kastelydomb-logo.png" alt="Kastélydomb Kávézó és Étterem" width={224} height={75} priority={!footer} />;
}

export default function Home() {
  return (
    <main id="top">
      <header className="site-header"><div className="shell header__inner">
        <a className="brand" href="#top" aria-label="Kastélydomb Kávézó és Étterem – kezdőlap"><Logo /></a>
        <nav className="desktop-nav" aria-label="Fő navigáció"><a href="#rolunk">Rólunk</a><a href="#etlap">Étlap</a><a href="#szolgaltatasok">Szolgáltatások</a><a href="#kapcsolat">Kapcsolat</a></nav>
        <Link className="button button--compact button--brown" href="/asztalfoglalas">Asztalfoglalás</Link>
        <details className="mobile-nav"><summary aria-label="Menü megnyitása"><span /><span /></summary><nav aria-label="Mobil navigáció"><a href="#rolunk">Rólunk</a><a href="#etlap">Étlap</a><a href="#szolgaltatasok">Szolgáltatások</a><a href="#kapcsolat">Kapcsolat</a><Link className="mobile-nav__cta" href="/asztalfoglalas">Asztalfoglalás</Link></nav></details>
      </div></header>

      <section className="hero" aria-labelledby="hero-title"><div className="shell hero__grid">
        <div className="hero__copy"><p className="eyebrow">Étterem · Rendezvények · Catering · Esküvők</p><h1 id="hero-title">Ahol az ízekből emlékek, a találkozásokból ünnepek lesznek.</h1><p className="hero__lead">Várpalota szívében nem csupán asztalt terítünk, hanem időt és teret adunk a legfontosabb pillanatoknak. A Kastélydomb Kávézó és Étteremben hiszünk abban, hogy a valódi vendéglátás ott kezdődik, ahol a tapintatos figyelem és a gasztronómiai szakértelem találkozik. Legyen szó egy ráérős vasárnapi ebédről, céges sikerek ünnepléséről vagy élete nagy napjáról, mi gondoskodunk arról, hogy Önnek csak egyetlen dolga legyen: megélni a pillanatot.</p><div className="button-row"><Link className="button button--brown" href="/asztalfoglalas">Asztalfoglalás</Link><a className="button button--olive" href="#etlap">Étlap megtekintése</a></div><p className="place">Várpalota · Kastélydomb</p></div>
        <div className="hero__visual"><div className="hero__slides" aria-hidden="true"><Image className="hero__slide hero__slide--one" src="/images/etterem-belso.webp" alt="" fill priority sizes="(max-width: 900px) 100vw, 48vw" /><Image className="hero__slide hero__slide--two" src="/images/etterem-03.webp" alt="" fill sizes="(max-width: 900px) 100vw, 48vw" /><Image className="hero__slide hero__slide--three" src="/images/etterem-08.webp" alt="" fill sizes="(max-width: 900px) 100vw, 48vw" /></div><div className="hero__badge"><strong>30+</strong><span>év vendéglátói<br />tapasztalat</span></div></div>
      </div></section>

      <section className="about section" id="rolunk"><div className="shell about__grid">
        <div className="about__visual"><div className="about__image about__image--large"><Image src="/images/etterem-08.webp" alt="Ünnepi teríték a Kastélydomb rendezvénytermében" fill sizes="(max-width: 900px) 100vw, 38vw" /></div><div className="about__image about__image--small"><Image src="/images/etterem-03.webp" alt="Elegáns teríték a Kastélydomb éttermében" fill sizes="(max-width: 900px) 48vw, 18vw" /></div></div>
        <div className="about__copy"><p className="section-label">01 · A mi történetünk – Kastélydomb</p><h2>Több mint egy szépen terített asztal: egy élmény, amelyet magával visz.</h2><p>A Kastélydomb páratlan atmoszférájában egy olyan teret álmodtunk meg, ahol az időt egy kicsit másképp mérik. Több mint 30 évnyi vendéglátói tapasztalattal pontosan tudjuk, hogy a valódi minőség nem csupán a tányérra kerülő ételeket jelenti. Sokkal inkább az apró részletek harmóniáját, az értő figyelmet és azt a megismételhetetlen érzést, amellyel a nap végén távozik tőlünk.</p><p>Legyen szó egy könnyed, de minőségi ebédről, egy meghitt, ráérős vacsoráról vagy a család legfontosabb ünnepeiről, nálunk minden alkalom személyre szabott gondoskodást kap. Hiszünk benne, hogy a legszebb emlékek mindig egy jó asztal körül születnek – mi pedig három évtizede dolgozunk azon, hogy ezek a pillanatok tökéletesek legyenek.</p></div>
      </div></section>

      <section className="menu section" id="etlap"><div className="shell menu__grid">
        <div className="menu__copy"><p className="section-label">02 · Kulináris kínálatunk</p><h2>Őszinte ízek, mesteri harmónia: a tányérra álmodott gondoskodás.</h2><p>Hisszük, hogy a tökéletes fogás titka a kiváló alapanyagokban és az értő elkészítésben rejlik. Étlapunkat úgy alkottuk meg, hogy a hagyományos, jól ismert ízek és a modern gasztronómia találkozása mindenki számára tartogasson valami különlegeset.</p><p>Nem gondoljuk túl, egyszerűen csak a maximumra törekszünk: akár egy könnyed családi ebédre, akár egy ráérős, ünnepi vacsorára érkezik, nálunk azok a tartalmas fogások várják, amelyekért érdemes asztalhoz ülni. A kulináris élményt pedig gondosan válogatott ital- és borkínálatunk teszi hiánytalanná.</p><div className="button-row"><a className="button button--brown" href="https://kastelydombkavezo.hu/etlap/" target="_blank" rel="noreferrer">Étlap megtekintése</a><a className="button button--olive" href="https://kastelydombkavezo.hu/etteremrol/italok/" target="_blank" rel="noreferrer">Itallap megtekintése</a></div></div>
        <div className="menu__image"><Image src="/images/wolt-borito.webp" alt="A Kastélydomb étterem fogásai" fill sizes="(max-width: 900px) 100vw, 45vw" /><div className="menu__caption">Hagyományos ízek · modern szemlélet</div></div>
      </div></section>

      <section className="parallax-divider" aria-label="A Kastélydomb hangulata"><div className="shell parallax-divider__content"><p>Kastélydomb · Várpalota</p><h2>A legszebb emlékek egy jó asztal körül születnek.</h2></div></section>

      <section className="services section" id="szolgaltatasok"><div className="shell">
        <div className="section-heading"><p className="section-label">03 · Több mint egy étterem – minden alkalomhoz a tökéletes háttér</p><h2>Személyre szabott vendéglátás, életének minden pillanatához.</h2><p>A Kastélydomb sokkal több egy klasszikus étteremnél. Több évtizedes tapasztalatunkkal arra törekszünk, hogy a legkülönbözőbb igényekre is tökéletes megoldást nyújtsunk. Legyen szó egy meghitt hétköznapi vacsoráról, megbízható közétkeztetésről, külső helyszínes cateringről vagy élete legfontosabb napjáról, az esküvőjéről – ismerje meg sokrétű szolgáltatásainkat!</p></div>
        <div className="services__grid">{services.map((service) => <article className="service-card" key={service.name}><ServiceIcon name={service.icon} /><h3>{service.name}</h3><strong className="service-card__title">{service.title}</strong><p>{service.text}</p><Link className="button service-card__button" href={service.href}>{service.cta}</Link></article>)}</div><p className="services__note">Az egyes szolgáltatások részletes, önálló céloldalai a következő fejlesztési ütemben készülnek el.</p>
      </div></section>

      <section className="booking-callout"><div className="shell booking-callout__inner"><div><p className="section-label">Asztalfoglalás</p><h2>Már tudja, mikor érkeznének?</h2><p>Egy közös ebéd, egy különleges vacsora vagy egy nagyobb családi alkalom előtt érdemes időben lefoglalni az asztalt.</p></div><div className="booking-callout__actions"><Link className="button button--brown" href="/asztalfoglalas">Asztalfoglalás</Link><a className="phone-link" href="tel:+36302644081">+36 30 264 4081</a></div></div></section>

      <section className="contact section" id="kapcsolat"><div className="shell">
        <div className="section-heading contact__heading"><p className="section-label">04 · Kapcsolat</p><h2>Találkozzunk a Kastélydombon.</h2><p>Asztalt foglalna, rendezvényt szervez vagy valamelyik szolgáltatásunkkal kapcsolatban kérdése van? Írjon nekünk az űrlapon, vagy keressen elérhetőségeink egyikén.</p></div>
        <div className="contact__layout"><aside className="contact-card"><div><span>Cím</span><strong>Kastélydomb Kávézó és Étterem</strong><p>8100 Várpalota, Mandulás ltp.</p></div><div><span>Telefon</span><a href="tel:+3688470350">+36 88 470 350</a><a href="tel:+36302644081">+36 30 264 4081</a></div><div><span>E-mail</span><a href="mailto:fenyocsaba@gmail.com">fenyocsaba@gmail.com</a></div><div><span>Nyitvatartás</span><p>Hétfő–csütörtök: 10:00–16:00<br />Péntek–szombat: 10:00–22:00<br />Vasárnap: 10:00–20:00</p></div><div><span>Parkolás</span><p>A vendégek számára parkolási lehetőség áll rendelkezésre.</p></div><a className="text-link" href="https://www.facebook.com/Kastelydombkavezo" target="_blank" rel="noreferrer">Facebook oldal</a></aside>
          <div className="form-stack"><div className="form-panel" id="erdeklodes"><p className="form-panel__eyebrow">Kapcsolatfelvétel</p><h3>Miben segíthetünk?</h3><p>Rendezvény, közétkeztetés, catering vagy esküvő? Írja meg röviden elképzeléseit.</p><ContactForm /></div></div>
        </div>
      </div></section>

      <footer className="footer"><div className="shell footer__main"><div className="footer__brand"><a href="#top"><Logo footer /></a><p>Étterem · Rendezvények · Catering · Esküvők</p></div><div><h3>Gyorslinkek</h3><a href="#rolunk">Rólunk</a><a href="#etlap">Étlap</a><a href="#szolgaltatasok">Szolgáltatások</a><Link href="/asztalfoglalas">Asztalfoglalás</Link></div><div><h3>Kapcsolat</h3><a href="tel:+36302644081">+36 30 264 4081</a><a href="mailto:fenyocsaba@gmail.com">fenyocsaba@gmail.com</a><p>8100 Várpalota, Mandulás ltp.</p></div><div><h3>Közösségi média</h3><a href="https://www.facebook.com/Kastelydombkavezo" target="_blank" rel="noreferrer">Facebook</a><span>Instagram · hamarosan</span></div></div><div className="shell footer__bottom"><span>© 2026 Kastélydomb Kávézó és Étterem</span><div><span>Impresszum · előkészítés alatt</span><span>Adatkezelés · előkészítés alatt</span><a href="#top">Vissza az oldal tetejére ↑</a></div></div></footer>
    </main>
  );
}
