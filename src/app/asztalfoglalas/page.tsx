import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReservationForm } from "../contact-form";

export const metadata: Metadata = {
  title: "Asztalfoglalás | Kastélydomb Kávézó és Étterem",
  description: "Asztalfoglalási igény küldése a várpalotai Kastélydomb Kávézó és Étterem részére.",
};

export default function ReservationPage() {
  return <main className="reservation-page">
    <header className="reservation-header"><div className="shell"><Link href="/" aria-label="Vissza a Kastélydomb kezdőlapjára"><Image className="logo" src="/images/kastelydomb-logo.png" alt="Kastélydomb Kávézó és Étterem" width={224} height={75} priority /></Link><Link className="reservation-back" href="/">Vissza a kezdőlapra</Link></div></header>
    <section className="reservation-section"><div className="shell reservation-grid"><div className="reservation-intro"><p className="section-label">Asztalfoglalás</p><h1>Foglaljon asztalt a Kastélydombon.</h1><p>Adja meg az alapadatokat, és küldje el foglalási igényét. A foglalás az étterem visszaigazolásával válik véglegessé.</p><div className="reservation-contact"><span>Telefonos foglalás</span><a href="tel:+36302644081">+36 30 264 4081</a></div></div><div className="reservation-form"><ReservationForm /></div></div></section>
  </main>;
}
