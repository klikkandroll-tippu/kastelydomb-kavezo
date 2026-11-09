import type { NextConfig } from "next";

const pages = [
  {
    "source": "/",
    "destination": "/kastelydomb-v2.html"
  },
  {
    "source": "/napi-menu",
    "destination": "/kastelydomb-napi-menu-v7.html"
  },
  {
    "source": "/etlap-itallap",
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

const nextConfig: NextConfig = {
  async redirects() {
    return pages.map(({ source, destination }) => ({
      source: destination,
      destination: source,
      permanent: true,
    }));
  },
  async rewrites() {
    // Serve HTML before App Router pages so the public URL stays clean.
    return { beforeFiles: pages };
  },
};

export default nextConfig;
