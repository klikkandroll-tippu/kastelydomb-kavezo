import type { MetadataRoute } from "next";
const origin = "https://kastelydombkavezo.hu";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: origin + "/", changeFrequency: "monthly", priority: 1 },
    { url: origin + "/napi-menu", changeFrequency: "weekly", priority: 0.9 },
    { url: origin + "/etlap-itallap", changeFrequency: "monthly", priority: 0.9 },
    { url: origin + "/asztalfoglalas", changeFrequency: "monthly", priority: 0.8 },
  ];
}
