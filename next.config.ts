import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/kastelydomb-v2.html" },
      { source: "/napi-menu", destination: "/kastelydomb-napi-menu-v7.html" },
    ];
  },
};

export default nextConfig;
