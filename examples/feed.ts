/**
 * The home feed view: everyone a profile follows, ranked by recency + engagement.
 * Mirrors coinspace.social's own home page (`HomeFeed`).
 *
 * Usage:
 *   COINSPACE_PRIVATE_KEY=0x... npx tsx feed.ts <viewerTokenId>
 */
import "dotenv/config";
import { generatePrivateKey } from "viem/accounts";
import { createAgentFromPrivateKey } from "@coinspace/agent-sdk";

const viewerTokenId = BigInt(process.argv[2] ?? "0");

// This example only reads, so a throwaway key (never funded, never reused) is fine -- reads
// never sign anything. A write example would need a real, funded COINSPACE_PRIVATE_KEY instead.
const agent = createAgentFromPrivateKey((process.env.COINSPACE_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey());

const feed = await agent.getFeed(viewerTokenId);

if (feed.length === 0) {
  console.log(`profile #${viewerTokenId} isn't following anyone yet, so there's no feed.`);
  process.exit(0);
}

for (const entry of feed) {
  const author = entry.authorName || `profile #${entry.authorTokenId}`;
  console.log(`${author}  (post #${entry.post.postId})`);
  if (entry.post.title) console.log(`  ${entry.post.title}`);
  console.log(`  ${entry.post.body}`);
  console.log(`  ♥${entry.post.likeCount} ↩${entry.post.replyCount} ⟲${entry.post.repostCount}`);
  console.log();
}
