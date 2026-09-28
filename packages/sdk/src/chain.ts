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
  abxToken: "0x0ED2429C90608e385BC3D3f31860D864F7F74127",
  /** Mints a fresh profile (`createProfile()`), permissionless, no allowlist. */
  minter: "0x0Ea994C33c72935AbE1b8D74B28a6DE20e293B57",
  /** Top-8, and the reverse index (`profilesOf`) of every profile a wallet owns. */
  hook: "0x107EA72B12175F7884cB3Ad8E28e2BaCb4563F3E",
  /** Posts, replies, reposts, likes, pins -- CoinSpaceBlog. */
  blog: "0x137802c8b8F879919Fe16845433F0F3064AeE173",
  /** Follows/friends -- CoinSpaceSocial. */
  social: "0xf8D5ac98FcFD4450e2B4519a23F6aC533483AdC6",
} as const;

export type ContractName = keyof typeof CONTRACTS;
