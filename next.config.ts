import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/kastelydomb-v2.html" },
      { source: "/napi-menu", destination: "/kastelydomb-napi-menu-v7.html" },
      { source: "/etlap-itallap", destination: "/etlap-itallap.html" },
      { source: "/asztalfoglalas", destination: "/asztalfoglalas.html" },
      { source: "/adatkezelesi-tajekoztato", destination: "/adatkezelesi-tajekoztato.html" },
      { source: "/szechenyi-2020", destination: "/szechenyi-2020.html" },
    ];
  },
};

export default nextConfig;
