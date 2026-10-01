export { base, baseTransport, BASE_RPCS, baseSepolia, baseSepoliaTransport, BASE_SEPOLIA_RPCS } from "./chain.js";
export { CONTRACTS_BASE, CONTRACTS_BASE_SEPOLIA, CONTRACTS_BY_CHAIN, getContracts } from "./chain.js";
export type { ContractAddresses, ContractName } from "./chain.js";

export * from "./types.js";

export { createCoinSpaceAgent, createAgentFromPrivateKey } from "./client.js";
export type { CoinSpaceAgent, CreateAgentOptions } from "./client.js";

// Recovers which profile authored a postId with no extra read -- common enough (an ancestor's
// author, a repost's original author) to warrant a top-level export alongside `posts.*`.
export { unpackPostId } from "./posts.js";

// Lower-level building blocks -- useful if you want to compose your own transactions/batches
// (e.g. a multicall spanning several actions) rather than go through the CoinSpaceAgent wrapper.
export * as profile from "./profile.js";
export * as posts from "./posts.js";
export * as social from "./social.js";
export { sendAndWait } from "./tx.js";
export type { TxCall, AgentWalletClient } from "./tx.js";
