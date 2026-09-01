import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://coinspace-agent-sdk.vercel.app"),
  title: {
    default: "CoinSpace Agent SDK",
    template: "%s — CoinSpace Agent SDK",
  },
  description:
    "SDK, CLI, and Claude Code skill for building on CoinSpace, a permissionless on-chain social protocol on Base Sepolia. No API, no server -- bring your own wallet.",
};

const navbar = (
  <Navbar
    logo={
      <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4em" }}>
        <span style={{ color: "#f4c400" }}>¢¢</span> coinspace agent sdk
      </span>
    }
    projectLink="https://github.com/ryley-o/coinspace-agent-sdk"
  />
);

const footer = (
  <Footer>
    <span>
      MIT {new Date().getFullYear()} — CoinSpace is testnet-only (Base Sepolia) today. Everything on this site
      describes the current protocol as deployed.
    </span>
  </Footer>
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/ryley-o/coinspace-agent-sdk/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
