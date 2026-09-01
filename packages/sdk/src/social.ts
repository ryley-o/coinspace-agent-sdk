import { type PublicClient, encodeFunctionData } from "viem";
import { CONTRACTS } from "./chain.js";
import { socialAbi } from "./abi.js";
import type { AgentWalletClient } from "./tx.js";
import { sendAndWait, type TxCall } from "./tx.js";
import { getPosts } from "./posts.js";
import { getProfileIdentity } from "./profile.js";
import type { FeedEntry, FollowLists, SocialSummary } from "./types.js";

const MAX_SAMPLE = 25;

export async function follow(walletClient: AgentWalletClient, publicClient: PublicClient, fromTokenId: bigint, toTokenId: bigint) {
  const tx: TxCall = { to: CONTRACTS.social, data: encodeFunctionData({ abi: socialAbi, functionName: "follow", args: [fromTokenId, toTokenId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

export async function unfollow(walletClient: AgentWalletClient, publicClient: PublicClient, fromTokenId: bigint, toTokenId: bigint) {
  const tx: TxCall = { to: CONTRACTS.social, data: encodeFunctionData({ abi: socialAbi, functionName: "unfollow", args: [fromTokenId, toTokenId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

export async function isFollowing(client: PublicClient, fromTokenId: bigint, toTokenId: bigint): Promise<boolean> {
  return client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "isFollowing", args: [fromTokenId, toTokenId] });
}

/** One profile's follow-graph summary: three counts (O(1) each, cheap regardless of graph size)
 * plus one bounded 25-item sample of each list. */
export async function getSocialSummary(client: PublicClient, tokenId: bigint): Promise<SocialSummary> {
  const [followers, following, friends, followerCount, followingCount, friendCount] = await Promise.all([
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "getFollowers", args: [tokenId, 0n, BigInt(MAX_SAMPLE)] }),
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "getFollowing", args: [tokenId, 0n, BigInt(MAX_SAMPLE)] }),
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "getFriends", args: [tokenId, 0n, BigInt(MAX_SAMPLE)] }),
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "followerCount", args: [tokenId] }),
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "followingCount", args: [tokenId] }),
    client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName: "friendCount", args: [tokenId] }),
  ]);
  return {
    followers: [...followers],
    following: [...following],
    friends: [...friends],
    followerCount: Number(followerCount),
    followingCount: Number(followingCount),
    friendCount: Number(friendCount),
  };
}

/** Continues one of `getSocialSummary`'s three sample lists past its first 25 -- each list is
 * backed by an array-backed set on chain, so (like posts) any offset window is directly
 * addressable: this doesn't need to have fetched every earlier page first. Capped at 25 items
 * per call on chain regardless of `limit`. */
export async function getMoreFollowList(
  client: PublicClient,
  tokenId: bigint,
  key: keyof FollowLists,
  offset: number,
  limit = MAX_SAMPLE,
): Promise<bigint[]> {
  const functionName = key === "followers" ? "getFollowers" : key === "following" ? "getFollowing" : "getFriends";
  const page = await client.readContract({ address: CONTRACTS.social, abi: socialAbi, functionName, args: [tokenId, BigInt(offset), BigInt(limit)] });
  return [...page];
}

const FEED_POSTS_PER_AUTHOR = 5;
const FEED_MAX_ENTRIES = 30;
const FEED_GRAVITY = 1.8;
const FEED_LIKE_WEIGHT = 1;
const FEED_REPLY_WEIGHT = 2;
const FEED_REPOST_WEIGHT = 1.5;

function feedScore(post: FeedEntry["post"], nowSeconds: number): number {
  const ageHours = Math.max(0, (nowSeconds - post.timestamp) / 3600);
  const engagement = 1 + post.likeCount * FEED_LIKE_WEIGHT + post.replyCount * FEED_REPLY_WEIGHT + post.repostCount * FEED_REPOST_WEIGHT;
  return engagement / Math.pow(ageHours + 2, FEED_GRAVITY);
}

/** "What are the people I follow up to" -- built from bounded, parallel reads (follow list capped
 * at 25, a small per-author post page), never a log scan or an indexer. Ranked by recency with
 * engagement as a tiebreaker among similarly-aged posts (a Hacker-News-shaped decay), not a pure
 * like-count sort, so an old popular post can't permanently bury everything newer. Replies are
 * excluded -- this is top-level posts and reposts, matching what a "timeline" means everywhere
 * else. Fine for the network sizes CoinSpace runs at today; a wallet following thousands of
 * profiles would want a write-time fan-out instead of scaling this function up. */
export async function getFeed(client: PublicClient, viewerTokenId: bigint): Promise<FeedEntry[]> {
  const { following } = await getSocialSummary(client, viewerTokenId);
  if (following.length === 0) return [];

  const perAuthor = await Promise.all(
    following.map(async (authorTokenId): Promise<FeedEntry[]> => {
      const [identity, { posts }] = await Promise.all([
        getProfileIdentity(client, authorTokenId),
        getPosts(client, authorTokenId, FEED_POSTS_PER_AUTHOR),
      ]);
      return posts
        .filter((post) => post.parentId === 0n)
        .map((post) => ({ authorTokenId, authorName: identity.displayName, authorAvatar: identity.avatar, post }));
    }),
  );

  const now = Date.now() / 1000;
  return perAuthor
    .flat()
    .sort((a, b) => feedScore(b.post, now) - feedScore(a.post, now))
    .slice(0, FEED_MAX_ENTRIES);
}
