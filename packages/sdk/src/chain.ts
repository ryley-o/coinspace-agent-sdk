import { type Address, defineChain, fallback, http, type HttpTransportConfig } from "viem";

/** The field shape shared by every chain's contract address book. Declared explicitly (rather
 * than inferred via `typeof` from one chain's literal object) so a second chain's real -- and
 * different -- addresses aren't forced to satisfy the first chain's exact string literal types. */
export interface ContractAddresses {
  /** ABX's ERC-721 profile token -- every CoinSpace page is one token here. Also where every
   * profile field (displayName, bio, avatar, ...) lives, as ABX PostParams. */
  abxToken: Address;
  /** Mints a fresh profile (`createProfile()`), permissionless, no allowlist. */
  minter: Address;
  /** Top-8, and the reverse index (`profilesOf`) of every profile a wallet owns. */
  hook: Address;
  /** Posts, replies, reposts, likes, pins -- CoinSpaceBlog. */
  blog: Address;
  /** Follows/friends -- CoinSpaceSocial. */
  social: Address;
}

export type ContractName = keyof ContractAddresses;

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

/** Public Base mainnet RPC endpoints, same fallover reasoning as BASE_SEPOLIA_RPCS -- no single
 * free public node is reliable enough to depend on alone, and that matters more with real funds
 * on mainnet than it does on a testnet. Bring your own RPC via `rpcUrl` for anything beyond light
 * usage. */
export const BASE_RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.drpc.org"] as const;

export const base = defineChain({
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [...BASE_RPCS] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://basescan.org" },
  },
  testnet: false,
});

export function baseTransport(config?: HttpTransportConfig) {
  return fallback(BASE_RPCS.map((url) => http(url, config)));
}

/** Resolves to `baseTransport()`/`baseSepoliaTransport()` for whichever chain id is given --
 * `createCoinSpaceAgent`'s own default-transport logic, factored out so it stays in sync with
 * `getContracts` below rather than drifting into its own copy of the chain-id check. */
export function defaultTransport(chainId: number, config?: HttpTransportConfig) {
  return chainId === base.id ? baseTransport(config) : baseSepoliaTransport(config);
}

/** CoinSpace's deployed contracts on Base Sepolia (testnet) -- live since this SDK's first
 * release, kept running for development/testing after mainnet shipped. */
export const CONTRACTS_BASE_SEPOLIA: ContractAddresses = {
  abxToken: "0x0ED2429C90608e385BC3D3f31860D864F7F74127",
  minter: "0x0Ea994C33c72935AbE1b8D74B28a6DE20e293B57",
  hook: "0x107EA72B12175F7884cB3Ad8E28e2BaCb4563F3E",
  blog: "0x137802c8b8F879919Fe16845433F0F3064AeE173",
  social: "0xf8D5ac98FcFD4450e2B4519a23F6aC533483AdC6",
} as const;

/** CoinSpace's deployed contracts on Base mainnet (chain id 8453) -- the production deployment,
 * live since 2026-09-29. This is where real profiles/posts/follows actually live now; Base
 * Sepolia above is for development and testing only. Mirrors the main CoinSpace app's own
 * `packages/shared/src/chain.ts` `CONTRACTS_BASE` entry -- update both together if either ever
 * redeploys (this SDK deliberately keeps its own copy rather than depending on that private repo). */
export const CONTRACTS_BASE: ContractAddresses = {
  abxToken: "0xc79E9315B8a5b1aa232eAdEe2B67d64eb74f1FAE",
  minter: "0xE12ed7f3032af4F137C38600106CF9d77ab16CD5",
  hook: "0x9032Ac74dd4Dd5a2e85B063b76D4583ecD5638DC",
  blog: "0x69EE5B7d59B6e9AE4d97eB9c4897d5c5A2C0547D",
  social: "0x27B46785615bb3ca5b2ABBc01675dBa73e009B02",
} as const;

export const CONTRACTS_BY_CHAIN: Record<number, ContractAddresses> = {
  [baseSepolia.id]: CONTRACTS_BASE_SEPOLIA,
  [base.id]: CONTRACTS_BASE,
};

/** Resolves the right address book for a given chain id. Every SDK function that touches a
 * contract takes `contracts: ContractAddresses` explicitly (rather than reading a module-level
 * singleton) so two agents in the same process can safely run against two different chains at
 * once -- `createCoinSpaceAgent` calls this once per agent and threads the result through. */
export function getContracts(chainId: number): ContractAddresses {
  const contracts = CONTRACTS_BY_CHAIN[chainId];
  if (!contracts) {
    const supported = Object.keys(CONTRACTS_BY_CHAIN).join(", ");
    throw new Error(`CoinSpace has no known deployment on chain id ${chainId}. Supported chain ids: ${supported}.`);
  }
  return contracts;
}
