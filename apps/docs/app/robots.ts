import type { MetadataRoute } from "next";

// Deliberately no disallowed paths -- this whole site exists to be found and read by both
// people and crawlers/agents, human or AI. No path here is sensitive or user-specific.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://docs.coinspace.social/sitemap.xml",
  };
}
