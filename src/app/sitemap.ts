import type { MetadataRoute } from "next";

const publicPages = ["/", "/napimenu", "/etlap", "/asztalfoglalas",
  "/ajanlatok", "/ajanlatok/karacsonyi-menu", "/palyazatok"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({ url: `https://kastelydombkavezo.hu${path}` }));
}
