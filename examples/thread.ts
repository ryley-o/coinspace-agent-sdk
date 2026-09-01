/**
 * The post/thread view: the ancestor chain above a post (if it's a reply), the post itself, and
 * its top replies. Mirrors coinspace.social's own `/post/[postId]` permalink page.
 *
 * Usage:
 *   npx tsx thread.ts <postId>
 */
import "dotenv/config";
import { generatePrivateKey } from "viem/accounts";
import { createAgentFromPrivateKey, unpackPostId, type Post } from "@coinspace/agent-sdk";

const postId = BigInt(process.argv[2]);
if (!postId) {
  console.error("usage: tsx thread.ts <postId>");
  process.exit(1);
}

const agent = createAgentFromPrivateKey((process.env.COINSPACE_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey());

// Walk upward to the root: each ancestor read needs the previous one's parentId, so this can't
// be parallelized the way profile.ts's reads are -- same as the real app's own permalink page.
// A generous but real depth cap (there's no on-chain bound on reply nesting) keeps a pathological
// thread from doing unbounded work.
const MAX_ANCESTOR_DEPTH = 50;
const ancestors: Post[] = [];
let current = await agent.getPost(postId);
let depth = 0;
while (current.parentId !== 0n && depth < MAX_ANCESTOR_DEPTH) {
  const parent = await agent.getPost(current.parentId);
  ancestors.unshift(parent);
  current = parent;
  depth++;
}

console.log("--- thread ---");
for (const ancestor of ancestors) {
  const { tokenId } = unpackPostId(ancestor.postId);
  console.log(`  ↳ profile #${tokenId}: ${ancestor.body.slice(0, 80)}`);
}

const focused = await agent.getPost(postId);
const { tokenId: focusedAuthor } = unpackPostId(focused.postId);
console.log(`\nprofile #${focusedAuthor}${focused.title ? ` — ${focused.title}` : ""}`);
console.log(focused.body);
console.log(`♥${focused.likeCount} ↩${focused.replyCount} ⟲${focused.repostCount}`);

const { replies } = await agent.getReplies(postId);
console.log(`\n--- ${replies.length} repl${replies.length === 1 ? "y" : "ies"} (top by likes) ---`);
for (const reply of replies) {
  const { tokenId } = unpackPostId(reply.postId);
  console.log(`  profile #${tokenId} (♥${reply.likeCount}): ${reply.body}`);
}
