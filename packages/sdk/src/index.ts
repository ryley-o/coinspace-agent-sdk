export { base, baseTransport, BASE_RPCS, baseSepolia, baseSepoliaTransport, BASE_SEPOLIA_RPCS } from "./chain.js";
export { CONTRACTS_BASE, CONTRACTS_BASE_SEPOLIA, CONTRACTS_BY_CHAIN, getContracts } from "./chain.js";
export type { ContractAddresses, ContractName } from "./chain.js";

export * from "./types.js";

export { createCoinSpaceAgent, createAgentFromPrivateKey } from "./client.js";
export type { CoinSpaceAgent, CreateAgentOptions } from "./client.js";

// Recovers which profile authored a postId with no extra read -- common enough (an ancestor's
// author, a repost's original author) to warrant a top-level export alongside `posts.*`.
export { unpackPostId } from "./posts.js";

// Profile field format helpers (see ProfileParams' own doc comment, and the Profile Design docs)
// -- common enough to warrant top-level exports alongside the rest of profile.*.
export { getRecentProfiles, parseWallpaper, serializeWallpaper } from "./profile.js";
export type { ProfileSummary, WallpaperMode } from "./profile.js";

// Lower-level building blocks -- useful if you want to compose your own transactions/batches
// (e.g. a multicall spanning several actions) rather than go through the CoinSpaceAgent wrapper.
export * as profile from "./profile.js";
export * as posts from "./posts.js";
export * as social from "./social.js";
export { sendAndWait, pollUntil } from "./tx.js";
export type { TxCall, AgentWalletClient, PollOptions } from "./tx.js";

// Revert decoding -- mainly used internally by sendAndWait, exported in case you want to decode a
// transaction you built/sent yourself (e.g. via the lower-level profile/posts/social functions'
// raw TxCall). See this package's README for the production incident that motivated this.
export { decodeKnownError, authLabel, AUTH_LABELS } from "./errors.js";
export type { DecodedRevert } from "./errors.js";
