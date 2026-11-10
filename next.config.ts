import type { NextConfig } from "next";

const pages = [
  {
    "source": "/",
    "destination": "/kastelydomb-v2.html"
  },
  {
    "source": "/napimenu",
    "destination": "/kastelydomb-napi-menu-v7.html"
  },
  {
    "source": "/etlap",
    "destination": "/etlap-itallap.html"
  },
  {
    "source": "/asztalfoglalas",
    "destination": "/asztalfoglalas.html"
  },
  {
    "source": "/adatkezelesi-tajekoztato",
    "destination": "/adatkezelesi-tajekoztato.html"
  },
  {
    "source": "/szechenyi-2020",
    "destination": "/szechenyi-2020.html"
  }
];

const sectionPaths = ["/szolgaltatasok", "/kapcsolat", "/rolunk"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/napi-menu", destination: "/napimenu", permanent: true },
      { source: "/etlap-itallap", destination: "/etlap", permanent: true },
      ...pages.map(({ source, destination }) => ({
      source: destination,
      destination: source,
      permanent: true,
    })),
    ];
  },
  async rewrites() {
    // Serve HTML before App Router pages so the public URL stays clean.
    return {
      beforeFiles: [
        ...pages,
        ...sectionPaths.map((source) => ({ source, destination: "/kastelydomb-v2.html" })),
      ],
    };
  },
};

export default nextConfig;
