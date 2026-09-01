/**
 * "Load more" patterns for the three paginated lists: a profile's posts, a post's replies, and a
 * profile's follow lists. See the docs' "Pagination & Scale" page for why posts/follow-lists can
 * jump directly to any page while replies have to be walked in order.
 *
 * Usage:
 *   npx tsx pagination.ts <tokenId> [postId]
 */
import "dotenv/config";
import { generatePrivateKey } from "viem/accounts";
import { createAgentFromPrivateKey } from "@coinspace-social/agent-sdk";

const tokenId = BigInt(process.argv[2] ?? "0");
const postIdArg = process.argv[3];

const agent = createAgentFromPrivateKey((process.env.COINSPACE_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey());

// --- posts: offset-based, direct-jump pagination -----------------------------------------------
console.log("--- posts, one page at a time ---");
let page = await agent.getPosts(tokenId, 5); // small page size just to make "more" likely here
console.log(page.posts.map((p) => p.index));
let pageCount = 1;
while (page.hasMore && pageCount < 3) {
  const oldestIndex = page.posts[page.posts.length - 1].index;
  page = await agent.getMorePosts(tokenId, oldestIndex, 5);
  console.log(page.posts.map((p) => p.index));
  pageCount++;
}

// --- follow lists: same offset-based shape, one list at a time ---------------------------------
console.log("\n--- followers, continued past the first 25 ---");
const summary = await agent.getSocialSummary(tokenId);
console.log(`loaded ${summary.followers.length} of ${summary.followerCount}`);
if (summary.followerCount > summary.followers.length) {
  const more = await agent.getMoreFollowList(tokenId, "followers", summary.followers.length);
  console.log(`loaded ${more.length} more`);
}

// --- replies: cursor-based, must be walked in order ---------------------------------------------
if (postIdArg) {
  console.log("\n--- replies, cursor-chained ---");
  const postId = BigInt(postIdArg);
  let cursor = 0n;
  let hop = 0;
  do {
    const { replies, nextCursor } = await agent.getReplies(postId, cursor, 5);
    console.log(replies.map((r) => r.postId.toString()));
    cursor = nextCursor;
    hop++;
  } while (cursor !== 0n && hop < 3);
}
