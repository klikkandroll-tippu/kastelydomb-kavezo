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
    "source": "/palyazatok",
    "destination": "/palyazatok.html"
  }
];

const sectionPaths = ["/szolgaltatasok", "/kapcsolat", "/rolunk"];
const canonicalHost = "https://kastelydombkavezo.hu";
const publicUrls = [...pages.map(({ source }) => source), ...sectionPaths,
  "/ajanlatok", "/ajanlatok/karacsonyi-menu", "/robots.txt", "/sitemap.xml"];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/napimenu": ["./public/kastelydomb-napi-menu-v7.html"],
  },
  async headers() {
    return ["/admin/:path*", "/api/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }));
  },
  async redirects() {
    return [
      ...publicUrls.map((source) => ({
        source,
        has: [{ type: "host" as const, value: "www\\.kastelydombkavezo\\.hu" }],
        destination: canonicalHost + source,
        permanent: true,
      })),
      { source: "/napi-menu", destination: "/napimenu", permanent: true },
      { source: "/etlap-itallap", destination: "/etlap", permanent: true },
      { source: "/szechenyi-2020", destination: "/palyazatok", permanent: true },
      { source: "/szechenyi-2020.html", destination: "/palyazatok", permanent: true },
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
        ...pages.filter(({ source }) => source !== "/napimenu"),
        ...sectionPaths.map((source) => ({ source, destination: "/kastelydomb-v2.html" })),
      ],
    };
  },
};

export default nextConfig;
