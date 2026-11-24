import type { ReactNode } from "react";
import "../../../public/funding.css";

export default function OffersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <footer className="offers-funding-footer">
        <a href="/palyazatok">Pályázatok</a>
        <div className="funding-footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/rrf-kedvezmenyezetti-infoblokk.jpg"
            width={1047}
            height={293}
            alt="Széchenyi Terv Plusz, Magyarország Kormánya és az Európai Unió, NextGenerationEU"
            loading="lazy"
          />
        </div>
      </footer>
      <a className="funding-badge" href="/palyazatok">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/szechenyi-2020-logo-bottom.png"
          width={670}
          height={469}
          alt="Széchenyi 2020 – pályázati információk"
        />
      </a>
    </>
  );
}
