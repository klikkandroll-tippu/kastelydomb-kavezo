import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Kastélydomb Kávézó és Étterem | Várpalota",
  description: "À la carte étterem, közétkeztetés, családi és céges rendezvények, esküvők és catering Várpalotán, több évtizedes tapasztalattal.",
  metadataBase: new URL("https://kastelydombkavezo.hu"),
  openGraph: {
    title: "Kastélydomb Kávézó és Étterem",
    description: "Ahol az ízekből emlékek, a találkozásokból ünnepek lesznek.",
    locale: "hu_HU",
    type: "website",
    images: [{ url: "/images/etterem-08.webp", width: 1200, height: 630, alt: "Kastélydomb Kávézó és Étterem" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="hu" className={`${dmSans.variable} ${playfair.variable}`}><body>{children}</body></html>; }
