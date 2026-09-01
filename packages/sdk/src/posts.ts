import { type PublicClient, encodeFunctionData, parseEventLogs } from "viem";
import { CONTRACTS } from "./chain.js";
import { blogAbi } from "./abi.js";
import type { AgentWalletClient } from "./tx.js";
import { sendAndWait, type TxCall } from "./tx.js";
import type { Post } from "./types.js";

export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 4000;

interface PostViewResult {
  postId: bigint;
  timestamp: number;
  hidden: boolean;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  parentId: bigint;
  repostOfId: bigint;
  title: string;
  body: string;
}

function toPost(p: PostViewResult, index: number): Post {
  return {
    postId: p.postId,
    index,
    timestamp: Number(p.timestamp),
    hidden: p.hidden,
    likeCount: Number(p.likeCount),
    replyCount: Number(p.replyCount),
    repostCount: Number(p.repostCount),
    parentId: p.parentId,
    repostOfId: p.repostOfId,
    title: p.title,
    body: p.body,
  };
}

function parsePostId(logs: import("viem").Log[]): bigint {
  const created = parseEventLogs({ abi: blogAbi, eventName: "PostCreated", logs });
  const postId = created[0]?.args.postId;
  if (postId === undefined) throw new Error("Transaction succeeded but no PostCreated event was found in the receipt.");
  return postId;
}

/** Publishes a new top-level post from `tokenId`. Returns the new post's global id. */
export async function post(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  tokenId: bigint,
  title: string,
  body: string,
): Promise<bigint> {
  const tx: TxCall = {
    to: CONTRACTS.blog,
    data: encodeFunctionData({ abi: blogAbi, functionName: "addPost", args: [tokenId, title, body] }),
    value: 0n,
  };
  const [receipt] = await sendAndWait(walletClient, publicClient, tx);
  return parsePostId(receipt.logs);
}

/** Replies to `parentId` as `tokenId`. A reply never carries a title. Returns the new post's id. */
export async function reply(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  tokenId: bigint,
  parentId: bigint,
  body: string,
): Promise<bigint> {
  const tx: TxCall = {
    to: CONTRACTS.blog,
    data: encodeFunctionData({ abi: blogAbi, functionName: "reply", args: [tokenId, parentId, body] }),
    value: 0n,
  };
  const [receipt] = await sendAndWait(walletClient, publicClient, tx);
  return parsePostId(receipt.logs);
}

/** Reposts `originalId` as `tokenId`, with optional commentary (empty string for a bare repost).
 * Returns the new post's id. */
export async function repost(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  tokenId: bigint,
  originalId: bigint,
  commentary = "",
): Promise<bigint> {
  const tx: TxCall = {
    to: CONTRACTS.blog,
    data: encodeFunctionData({ abi: blogAbi, functionName: "repost", args: [tokenId, originalId, commentary] }),
    value: 0n,
  };
  const [receipt] = await sendAndWait(walletClient, publicClient, tx);
  return parsePostId(receipt.logs);
}

export async function like(walletClient: AgentWalletClient, publicClient: PublicClient, tokenId: bigint, postId: bigint) {
  const tx: TxCall = { to: CONTRACTS.blog, data: encodeFunctionData({ abi: blogAbi, functionName: "like", args: [tokenId, postId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

export async function unlike(walletClient: AgentWalletClient, publicClient: PublicClient, tokenId: bigint, postId: bigint) {
  const tx: TxCall = { to: CONTRACTS.blog, data: encodeFunctionData({ abi: blogAbi, functionName: "unlike", args: [tokenId, postId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

/** Moderation of your own mistakes, not deletion -- the text stays fully readable via a direct
 * RPC/explorer read forever. One-way: there's no un-hide. */
export async function hide(walletClient: AgentWalletClient, publicClient: PublicClient, postId: bigint) {
  const tx: TxCall = { to: CONTRACTS.blog, data: encodeFunctionData({ abi: blogAbi, functionName: "hidePost", args: [postId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

/** Pins `postId` (must be authored by `tokenId`) to the top of `tokenId`'s page. Pass `postId:
 * 0n` to unpin -- there's no separate unpin call, one nullable slot is the whole API. */
export async function pin(walletClient: AgentWalletClient, publicClient: PublicClient, tokenId: bigint, postId: bigint) {
  const tx: TxCall = { to: CONTRACTS.blog, data: encodeFunctionData({ abi: blogAbi, functionName: "pinPost", args: [tokenId, postId] }), value: 0n };
  await sendAndWait(walletClient, publicClient, tx);
}

export async function getPost(client: PublicClient, postId: bigint): Promise<Post> {
  const p = await client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "getPost", args: [postId] });
  return toPost(p, 0);
}

export async function hasLiked(client: PublicClient, postId: bigint, tokenId: bigint): Promise<boolean> {
  return client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "hasLiked", args: [postId, tokenId] });
}

/** Most recent `count` posts for a profile, newest first, hidden ones filtered out -- base posts,
 * replies, and reposts this profile has authored, all mixed together (that IS the profile's
 * timeline). `hasMore` tells you whether `getMorePosts` has anything further back to fetch. */
export async function getPosts(client: PublicClient, tokenId: bigint, count = 20): Promise<{ posts: Post[]; hasMore: boolean }> {
  const total = await client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "postCount", args: [tokenId] });
  if (total === 0n) return { posts: [], hasMore: false };
  const wanted = BigInt(count);
  const offset = total > wanted ? total - wanted : 0n;
  const page = await client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "getPosts", args: [tokenId, offset, wanted] });
  const posts = page.map((p, i) => toPost(p, Number(offset) + i)).filter((p) => !p.hidden).reverse();
  return { posts, hasMore: offset > 0n };
}

/** Continues `getPosts` further into the past -- pass the `.index` of the oldest post you've
 * already loaded (the last element of a `getPosts`/`getMorePosts` result). Every window here is
 * directly offset-addressable on chain, so this jumps straight to the right page in one call --
 * no need to have fetched every page in between. */
export async function getMorePosts(client: PublicClient, tokenId: bigint, beforeIndex: number, count = 20): Promise<{ posts: Post[]; hasMore: boolean }> {
  if (beforeIndex <= 0) return { posts: [], hasMore: false };
  const wanted = BigInt(count);
  const before = BigInt(beforeIndex);
  const offset = before > wanted ? before - wanted : 0n;
  const limit = before - offset;
  const page = await client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "getPosts", args: [tokenId, offset, limit] });
  const posts = page.map((p, i) => toPost(p, Number(offset) + i)).filter((p) => !p.hidden).reverse();
  return { posts, hasMore: offset > 0n };
}

/** The most-liked replies to `parentId`, ranked live on chain -- `cursor: 0n` starts from the
 * top; pass back `nextCursor` to continue (`0n` once exhausted). This is a resume-from-here
 * cursor over a live-reordering rank, not an offset -- see the docs' "Pagination" page for why
 * that means it can't jump to an arbitrary page the way `getPosts` can. */
export async function getReplies(client: PublicClient, parentId: bigint, cursor = 0n, limit = 25): Promise<{ replies: Post[]; nextCursor: bigint }> {
  const [page, nextCursor] = await client.readContract({
    address: CONTRACTS.blog,
    abi: blogAbi,
    functionName: "getReplies",
    args: [parentId, cursor, BigInt(limit)],
  });
  return { replies: page.map((p, i) => toPost(p, i)), nextCursor };
}

export async function getPinnedPost(client: PublicClient, tokenId: bigint): Promise<Post | null> {
  const [pinned, p] = await client.readContract({ address: CONTRACTS.blog, abi: blogAbi, functionName: "getPinnedPost", args: [tokenId] });
  return pinned ? toPost(p, 0) : null;
}

/** Recovers which profile authored `postId` from the id itself (`((tokenId + 1) << 128) |
 * index`) -- no extra read needed, e.g. to find the author of a `parentId`/`repostOfId`. */
export function unpackPostId(postId: bigint): { tokenId: bigint; index: bigint } {
  const INDEX_BITS = 128n;
  return { tokenId: (postId >> INDEX_BITS) - 1n, index: postId & ((1n << INDEX_BITS) - 1n) };
}

export function validatePost(title: string, body: string): string | null {
  if (!title.trim()) return "Title is required.";
  if (title.length > MAX_TITLE_LENGTH) return `Titles top out at ${MAX_TITLE_LENGTH} characters.`;
  if (!body.trim()) return "Body is required.";
  if (body.length > MAX_BODY_LENGTH) return `Bodies top out at ${MAX_BODY_LENGTH} characters.`;
  return null;
}
