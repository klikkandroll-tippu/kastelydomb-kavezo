"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); event.currentTarget.reset(); }
  return <form className="contact-form" onSubmit={handleSubmit}>
    <div className="form-field"><label htmlFor="name">Név</label><input id="name" name="name" autoComplete="name" required placeholder="Teljes név" /></div>
    <div className="form-field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="nev@email.hu" /></div>
    <div className="form-field form-field--wide"><label htmlFor="topic">Miben segíthetünk?</label><select id="topic" name="topic" defaultValue="Asztalfoglalás"><option>Asztalfoglalás</option><option>À la carte étterem</option><option>Közétkeztetés</option><option>Családi vagy céges esemény</option><option>Esküvő</option><option>Catering</option><option>Egyéb kérdés</option></select></div>
    <div className="form-field form-field--wide"><label htmlFor="message">Üzenet</label><textarea id="message" name="message" required placeholder="Írd meg röviden, miben segíthetünk…" /></div>
    <div className="form-submit"><button className="button button--red" type="submit">Üzenet küldése <span>↗</span></button><p aria-live="polite">{sent ? "Köszönjük! A tervezetben az űrlap bemutató módban működik." : ""}</p></div>
  </form>;
}
