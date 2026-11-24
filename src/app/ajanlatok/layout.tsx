import Script from "next/script";
import type { ReactNode } from "react";
import "../../../public/funding.css";

const fundingGraphics = {
  "2020": {
    src: "/images/szechenyi-2020-logo-bottom.png",
    width: 670,
    height: 469,
    alt: "Széchenyi 2020 – pályázati információk",
  },
  rrf: {
    src: "/images/rrf-kedvezmenyezetti-infoblokk.jpg",
    width: 1047,
    height: 293,
    alt: "Széchenyi Terv Plusz, Magyarország Kormánya és az Európai Unió, NextGenerationEU – pályázati információk",
  },
};

function FundingLinks({ placement }: { placement: "intro" | "footer" }) {
  const order = placement === "intro" ? (["rrf", "2020"] as const) : (["2020", "rrf"] as const);

  return (
    <div className={`funding-${placement}`}>
      {order.map((variant) => {
        const { alt, ...image } = fundingGraphics[variant];

        return (
          <a key={variant} className={`funding-link funding-link-${variant}`} href="/palyazatok">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...image} alt={alt} loading={placement === "footer" ? "lazy" : "eager"} />
          </a>
        );
      })}
    </div>
  );
}

export default function OffersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <footer className="offers-funding-footer">
        <a href="/palyazatok">Pályázatok</a>
        <FundingLinks placement="footer" />
      </footer>
      <FundingLinks placement="intro" />
      <Script src="/funding.js" />
    </>
  );
}
