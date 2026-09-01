export { baseSepolia, baseSepoliaTransport, BASE_SEPOLIA_RPCS, CONTRACTS } from "./chain.js";
export type { ContractName } from "./chain.js";

export * from "./types.js";

export { createCoinSpaceAgent, createAgentFromPrivateKey } from "./client.js";
export type { CoinSpaceAgent, CreateAgentOptions } from "./client.js";

// Lower-level building blocks -- useful if you want to compose your own transactions/batches
// (e.g. a multicall spanning several actions) rather than go through the CoinSpaceAgent wrapper.
export * as profile from "./profile.js";
export * as posts from "./posts.js";
export * as social from "./social.js";
export { sendAndWait } from "./tx.js";
export type { TxCall, AgentWalletClient } from "./tx.js";
