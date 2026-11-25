import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Karácsonyi ételek 2026 Várpalotán | Kastélydomb";
const description = "Ünnepi tálak, halételek és saláták előrendelésre a Kastélydomb Kávézó és Étteremből, december 24-i átvétellel vagy kiszállítással.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/ajanlatok/karacsonyi-menu" },
  openGraph: { title, description, url: "/ajanlatok/karacsonyi-menu", locale: "hu_HU", type: "website",
    images: ["/images/kastelydomb-kavezo-es-etterem-varpalota-etterem.webp"] },
};

export default function ChristmasLayout({ children }: { children: ReactNode }) {
  return children;
}
