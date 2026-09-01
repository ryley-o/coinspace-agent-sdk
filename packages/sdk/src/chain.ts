import { defineChain, fallback, http, type HttpTransportConfig } from "viem";

/** Public Base Sepolia RPC endpoints, tried in order with automatic fallover -- no single public
 * node is reliable enough to depend on alone (sepolia.base.org in particular 503s under load
 * often enough to notice). Override with your own RPC via `rpcUrl` on `createCoinSpaceAgent` if
 * you have one; the public defaults are fine for getting started and for light usage. */
export const BASE_SEPOLIA_RPCS = [
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.drpc.org",
  "https://base-sepolia.gateway.tenderly.co",
  "https://sepolia.base.org",
] as const;

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [...BASE_SEPOLIA_RPCS] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
});

export function baseSepoliaTransport(config?: HttpTransportConfig) {
  return fallback(BASE_SEPOLIA_RPCS.map((url) => http(url, config)));
}

/** CoinSpace's deployed contracts on Base Sepolia. CoinSpace is testnet-only today (see the docs'
 * "Networks" page) -- this is the one address book the whole protocol runs on right now. Update
 * here, and only here, if/when a mainnet deployment ships. */
export const CONTRACTS = {
  /** ABX's ERC-721 profile token -- every CoinSpace page is one token here. Also where every
   * profile field (displayName, bio, avatar, ...) lives, as ABX PostParams. */
  abxToken: "0x1D4dE4bE91D2B4A86c634Dde68F8aCbbC7A1eE74",
  /** Mints a fresh profile (`createProfile()`), permissionless, no allowlist. */
  minter: "0x9d4661947C17EcD0Dd8C585036E1575C5E72Da84",
  /** Top-8, and the reverse index (`profilesOf`) of every profile a wallet owns. */
  hook: "0xb700CF46C1E69c71fa6248E567634c6f781dF563",
  /** Posts, replies, reposts, likes, pins -- CoinSpaceBlog. */
  blog: "0xC07f19b22CA1193a3a62245584A15a8D122f3163",
  /** Follows/friends -- CoinSpaceSocial. */
  social: "0x63A6a7470EBaCFfF4a2A8B32e586d7030EAdfD71",
} as const;

export type ContractName = keyof typeof CONTRACTS;
