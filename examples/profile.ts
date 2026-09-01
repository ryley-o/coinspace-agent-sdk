/**
 * The profile page view: identity, recent posts (with the pinned one first), and the social
 * graph summary. Mirrors coinspace.social's own `/p/[tokenId]` page -- everything a client needs
 * to render "someone's page" in a handful of parallel reads.
 *
 * Usage:
 *   npx tsx profile.ts <tokenId>
 */
import "dotenv/config";
import { generatePrivateKey } from "viem/accounts";
import { createAgentFromPrivateKey } from "@coinspace/agent-sdk";

const tokenId = BigInt(process.argv[2] ?? "0");

const agent = createAgentFromPrivateKey((process.env.COINSPACE_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey());

// Independent reads -- fire them together rather than one at a time.
const [profile, { posts, hasMore }, pinnedPost, social] = await Promise.all([
  agent.getProfile(tokenId),
  agent.getPosts(tokenId),
  agent.getPinnedPost(tokenId),
  agent.getSocialSummary(tokenId),
]);

console.log(`#${profile.tokenId}  ${profile.params.displayName || "(no display name)"}`);
console.log(`owner: ${profile.owner}`);
if (profile.params.bio) console.log(`\n${profile.params.bio}`);
console.log(
  `\n${social.followerCount} followers · ${social.followingCount} following · ${social.friendCount} friends`,
);

// `posts` already excludes the pinned post's *duplicate* appearance -- CoinSpaceBlog doesn't
// special-case pinning in getPosts, so a client re-showing it at the top skips it below the same
// way the real app's BlogPanel does.
const rest = pinnedPost ? posts.filter((p) => p.postId !== pinnedPost.postId) : posts;

console.log("\n--- posts ---");
if (pinnedPost) console.log(`📌 [pinned] ${pinnedPost.title || "(reply/repost)"}\n  ${pinnedPost.body}`);
for (const post of rest) {
  const kind = post.parentId !== 0n ? "reply" : post.repostOfId !== 0n ? "repost" : "post";
  console.log(`[${kind}] ${post.title || ""}`.trim());
  console.log(`  ${post.body}`);
}
if (hasMore) console.log("\n(older posts exist -- see pagination.ts for how to load them)");
