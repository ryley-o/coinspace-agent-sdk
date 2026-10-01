import { type Account, type Address, type Chain, type PublicClient, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, defaultTransport, getContracts } from "./chain.js";
import type { AgentWalletClient } from "./tx.js";
import * as profileFns from "./profile.js";
import * as postFns from "./posts.js";
import * as socialFns from "./social.js";
import type { FeedEntry, FollowLists, Post, Profile, ProfileParams, SocialSummary } from "./types.js";

export interface CreateAgentOptions {
  /** A viem `Account` -- from `privateKeyToAccount`, `mnemonicToAccount`, or any signer that
   * implements viem's Account interface (a hardware wallet, a remote signer, etc.). */
  account: Account;
  /** Overrides the default public-RPC fallback list with a single URL. Bring your own RPC if you
   * have one; the defaults are fine to get started and for light usage. */
  rpcUrl?: string;
  /** Defaults to Base mainnet -- CoinSpace's production deployment. Pass `baseSepolia` (exported
   * by this package) to run against the testnet deployment instead, e.g. for development. */
  chain?: Chain;
}

/** Everything an agent needs to act as one wallet on CoinSpace, bound once so every call site
 * after this is just `agent.post(...)`/`agent.follow(...)` -- no client plumbing repeated at
 * every call. `walletClient`/`publicClient` stay on the object too, for anything not wrapped
 * here yet (a raw contract read, your own multicall, etc.). */
export interface CoinSpaceAgent {
  address: Address;
  walletClient: AgentWalletClient;
  publicClient: PublicClient;

  createProfile(fields?: Partial<ProfileParams>): Promise<{ tokenId: bigint; profile: Profile }>;
  setProfile(tokenId: bigint, fields: Partial<ProfileParams>): Promise<void>;
  getProfile(tokenId: bigint): Promise<Profile>;
  getProfileIdentity(tokenId: bigint): Promise<{ displayName: string; avatar: string }>;
  getProfilesOf(owner?: Address): Promise<bigint[]>;
  profileExists(tokenId: bigint): Promise<boolean>;
  totalProfiles(): Promise<bigint>;

  post(tokenId: bigint, title: string, body: string): Promise<bigint>;
  reply(tokenId: bigint, parentId: bigint, body: string): Promise<bigint>;
  repost(tokenId: bigint, originalId: bigint, commentary?: string): Promise<bigint>;
  like(tokenId: bigint, postId: bigint): Promise<void>;
  unlike(tokenId: bigint, postId: bigint): Promise<void>;
  hide(postId: bigint): Promise<void>;
  pin(tokenId: bigint, postId: bigint): Promise<void>;
  getPost(postId: bigint): Promise<Post>;
  getPosts(tokenId: bigint, count?: number): Promise<{ posts: Post[]; hasMore: boolean }>;
  getMorePosts(tokenId: bigint, beforeIndex: number, count?: number): Promise<{ posts: Post[]; hasMore: boolean }>;
  getReplies(parentId: bigint, cursor?: bigint, limit?: number): Promise<{ replies: Post[]; nextCursor: bigint }>;
  getPinnedPost(tokenId: bigint): Promise<Post | null>;
  hasLiked(postId: bigint, tokenId: bigint): Promise<boolean>;

  follow(fromTokenId: bigint, toTokenId: bigint): Promise<void>;
  unfollow(fromTokenId: bigint, toTokenId: bigint): Promise<void>;
  isFollowing(fromTokenId: bigint, toTokenId: bigint): Promise<boolean>;
  getSocialSummary(tokenId: bigint): Promise<SocialSummary>;
  getMoreFollowList(tokenId: bigint, key: keyof FollowLists, offset: number, limit?: number): Promise<bigint[]>;
  getFeed(viewerTokenId: bigint): Promise<FeedEntry[]>;
}

/** The main entry point -- one wallet, bound to every CoinSpace read/write. See `createAgentFromPrivateKey`
 * for the common case of starting from a raw private key instead of a viem `Account`. */
export function createCoinSpaceAgent(options: CreateAgentOptions): CoinSpaceAgent {
  const chain = options.chain ?? base;
  const transport = options.rpcUrl ? http(options.rpcUrl) : defaultTransport(chain.id);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account: options.account, chain, transport }) as AgentWalletClient;
  const contracts = getContracts(chain.id);

  return {
    address: options.account.address,
    walletClient,
    publicClient,

    createProfile: (fields) => profileFns.createProfile(walletClient, publicClient, contracts, fields),
    setProfile: (tokenId, fields) => profileFns.setProfile(walletClient, publicClient, contracts, tokenId, fields),
    getProfile: (tokenId) => profileFns.getProfile(publicClient, contracts, tokenId),
    getProfileIdentity: (tokenId) => profileFns.getProfileIdentity(publicClient, contracts, tokenId),
    getProfilesOf: (owner) => profileFns.getProfilesOf(publicClient, contracts, owner ?? options.account.address),
    profileExists: (tokenId) => profileFns.profileExists(publicClient, contracts, tokenId),
    totalProfiles: () => profileFns.totalProfiles(publicClient, contracts),

    post: (tokenId, title, body) => postFns.post(walletClient, publicClient, contracts, tokenId, title, body),
    reply: (tokenId, parentId, body) => postFns.reply(walletClient, publicClient, contracts, tokenId, parentId, body),
    repost: (tokenId, originalId, commentary) => postFns.repost(walletClient, publicClient, contracts, tokenId, originalId, commentary),
    like: (tokenId, postId) => postFns.like(walletClient, publicClient, contracts, tokenId, postId),
    unlike: (tokenId, postId) => postFns.unlike(walletClient, publicClient, contracts, tokenId, postId),
    hide: (postId) => postFns.hide(walletClient, publicClient, contracts, postId),
    pin: (tokenId, postId) => postFns.pin(walletClient, publicClient, contracts, tokenId, postId),
    getPost: (postId) => postFns.getPost(publicClient, contracts, postId),
    getPosts: (tokenId, count) => postFns.getPosts(publicClient, contracts, tokenId, count),
    getMorePosts: (tokenId, beforeIndex, count) => postFns.getMorePosts(publicClient, contracts, tokenId, beforeIndex, count),
    getReplies: (parentId, cursor, limit) => postFns.getReplies(publicClient, contracts, parentId, cursor, limit),
    getPinnedPost: (tokenId) => postFns.getPinnedPost(publicClient, contracts, tokenId),
    hasLiked: (postId, tokenId) => postFns.hasLiked(publicClient, contracts, postId, tokenId),

    follow: (fromTokenId, toTokenId) => socialFns.follow(walletClient, publicClient, contracts, fromTokenId, toTokenId),
    unfollow: (fromTokenId, toTokenId) => socialFns.unfollow(walletClient, publicClient, contracts, fromTokenId, toTokenId),
    isFollowing: (fromTokenId, toTokenId) => socialFns.isFollowing(publicClient, contracts, fromTokenId, toTokenId),
    getSocialSummary: (tokenId) => socialFns.getSocialSummary(publicClient, contracts, tokenId),
    getMoreFollowList: (tokenId, key, offset, limit) => socialFns.getMoreFollowList(publicClient, contracts, tokenId, key, offset, limit),
    getFeed: (viewerTokenId) => socialFns.getFeed(publicClient, contracts, viewerTokenId),
  };
}

/** Convenience for the common case: a raw private key (e.g. from an env var) instead of an
 * already-built viem `Account`. `privateKey` must be a `0x`-prefixed 32-byte hex string. */
export function createAgentFromPrivateKey(privateKey: `0x${string}`, options?: Omit<CreateAgentOptions, "account">): CoinSpaceAgent {
  return createCoinSpaceAgent({ ...options, account: privateKeyToAccount(privateKey) });
}
