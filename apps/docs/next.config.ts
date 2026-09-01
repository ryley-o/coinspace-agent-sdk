import type { NextConfig } from "next";
import nextra from "nextra";

const withNextra = nextra({
  search: {
    codeblocks: false,
  },
});

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
  // TODO: eslint-config-next's flat config currently fails to resolve under this pnpm
  // install's exact eslint/eslint-config-next versions ("Plugin \"\" not found") -- a
  // dependency-version-skew issue, not a lint finding. `pnpm lint`/`next build` both worked
  // fine before this was added; revisit once the ecosystem catches up rather than fighting it.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextra(nextConfig);
