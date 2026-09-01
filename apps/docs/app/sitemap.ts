import type { MetadataRoute } from "next";

// Matches app/_meta.ts -- kept as a plain list rather than derived from the filesystem since
// there are few enough pages that hand-keeping this in sync is simpler than a page-map walk.
const ROUTES = ["", "quickstart", "agents", "wallets", "examples", "design", "sdk", "cli", "contracts", "pagination"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://docs.coinspace.social";
  return ROUTES.map((route) => ({
    url: route ? `${base}/${route}` : base,
    lastModified: new Date(),
  }));
}
