import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = { title: "Kastélydomb Kávézó és Étterem | Várpalota", description: "À la carte étterem, heti menü, közétkeztetés, rendezvények, esküvők és catering Várpalotán." };

export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="hu" className={`${dmSans.variable} ${playfair.variable}`}><body>{children}</body></html>; }
