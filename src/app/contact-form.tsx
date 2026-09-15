"use client";

import { FormEvent, useState } from "react";

const recipient = "fenyocsaba@gmail.com";

function openEmail(subject: string, lines: string[]) {
  const body = lines.filter(Boolean).join("\n");
  window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ReservationForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    openEmail("Asztalfoglalási igény – Kastélydomb", [
      `Név: ${form.get("name")}`,
      `Telefonszám: ${form.get("phone")}`,
      `E-mail: ${form.get("email") || "–"}`,
      `Dátum: ${form.get("date")}`,
      `Érkezés: ${form.get("time")}`,
      `Létszám: ${form.get("guests")} fő`,
      "",
      `Megjegyzés: ${form.get("message") || "–"}`,
    ]);
    setSent(true);
  }

  return <form className="contact-form" onSubmit={handleSubmit}>
    <div className="form-field"><label htmlFor="reservation-name">Név*</label><input id="reservation-name" name="name" autoComplete="name" required placeholder="Teljes név" /></div>
    <div className="form-field"><label htmlFor="reservation-phone">Telefonszám*</label><input id="reservation-phone" name="phone" type="tel" autoComplete="tel" required placeholder="+36 30 000 0000" /></div>
    <div className="form-field form-field--wide"><label htmlFor="reservation-email">E-mail cím</label><input id="reservation-email" name="email" type="email" autoComplete="email" placeholder="pelda@email.hu" /></div>
    <div className="form-field"><label htmlFor="reservation-date">Dátum*</label><input id="reservation-date" name="date" type="date" required /></div>
    <div className="form-field"><label htmlFor="reservation-time">Érkezés időpontja*</label><input id="reservation-time" name="time" type="time" required /></div>
    <div className="form-field form-field--wide"><label htmlFor="reservation-guests">Létszám*</label><input id="reservation-guests" name="guests" type="number" inputMode="numeric" min="1" max="100" required placeholder="2" /></div>
    <div className="form-field form-field--wide"><label htmlFor="reservation-message">Megjegyzés</label><textarea id="reservation-message" name="message" placeholder="Ha van különleges kérése, írja meg itt." /></div>
    <label className="consent"><input type="checkbox" required /> <span>Elolvastam és elfogadom az Adatkezelési tájékoztatót.</span></label>
    <div className="form-submit"><button className="button button--red" type="submit">Foglalási igény elküldése <span aria-hidden="true">↗</span></button><p aria-live="polite">{sent ? "Megnyitottuk az e-mail-küldést. A foglalás az étterem visszaigazolásával válik véglegessé." : "A foglalás az étterem visszaigazolásával válik véglegessé."}</p></div>
  </form>;
}

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    openEmail(`${form.get("topic")} – érdeklődés`, [
      `Név: ${form.get("name")}`,
      `E-mail: ${form.get("email")}`,
      `Telefon: ${form.get("phone") || "–"}`,
      `Téma: ${form.get("topic")}`,
      "",
      String(form.get("message")),
    ]);
    setSent(true);
  }

  return <form className="contact-form" onSubmit={handleSubmit}>
    <div className="form-field"><label htmlFor="contact-name">Név*</label><input id="contact-name" name="name" autoComplete="name" required placeholder="Teljes név" /></div>
    <div className="form-field"><label htmlFor="contact-email">E-mail*</label><input id="contact-email" name="email" type="email" autoComplete="email" required placeholder="pelda@email.hu" /></div>
    <div className="form-field form-field--wide"><label htmlFor="contact-phone">Telefonszám</label><input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder="+36 30 000 0000" /></div>
    <div className="form-field form-field--wide"><label htmlFor="contact-topic">Érdeklődés témája*</label><select id="contact-topic" name="topic" defaultValue="Családi rendezvény" required><option>Étterem</option><option>Közétkeztetés</option><option>Családi rendezvény</option><option>Céges rendezvény</option><option>Catering</option><option>Esküvő</option><option>Egyéb</option></select></div>
    <div className="form-field form-field--wide"><label htmlFor="contact-message">Üzenet*</label><textarea id="contact-message" name="message" required placeholder="Írja meg röviden, miben segíthetünk…" /></div>
    <label className="consent"><input type="checkbox" required /> <span>Elolvastam és elfogadom az Adatkezelési tájékoztatót.</span></label>
    <div className="form-submit"><button className="button" type="submit">Üzenet küldése <span aria-hidden="true">↗</span></button><p aria-live="polite">{sent ? "Megnyitottuk az e-mail-küldést az elkészített üzenettel." : "Az üzenet az Ön levelezőprogramjában nyílik meg."}</p></div>
  </form>;
}
