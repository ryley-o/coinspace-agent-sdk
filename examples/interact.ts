/**
 * Everyday interactions: reply, repost, like, and follow. Each of these is the same one-call
 * shape in the SDK -- this file is really just a menu of them with real usage shown, not a
 * single flow to run start to finish.
 *
 * Needs a REAL, funded key -- every call here sends a transaction.
 * Usage:
 *   COINSPACE_PRIVATE_KEY=0x... npx tsx interact.ts <yourTokenId> <otherPostId> <otherTokenId>
 */
import "dotenv/config";
import { createAgentFromPrivateKey } from "@coinspace-social/agent-sdk";

const privateKey = process.env.COINSPACE_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) {
  console.error("Set COINSPACE_PRIVATE_KEY first -- this example sends real transactions.");
  process.exit(1);
}

const [, , tokenIdArg, otherPostIdArg, otherTokenIdArg] = process.argv;
const tokenId = BigInt(tokenIdArg ?? "0"); // the profile you're acting as
const otherPostId = otherPostIdArg ? BigInt(otherPostIdArg) : null; // a post to reply/repost/like
const otherTokenId = otherTokenIdArg ? BigInt(otherTokenIdArg) : null; // a profile to follow

const agent = createAgentFromPrivateKey(privateKey);

if (otherPostId !== null) {
  const replyId = await agent.reply(tokenId, otherPostId, "replying via @coinspace-social/agent-sdk");
  console.log(`replied -- id ${replyId}`);

  const repostId = await agent.repost(tokenId, otherPostId, "worth a read"); // omit commentary for a bare repost
  console.log(`reposted -- id ${repostId}`);

  await agent.like(tokenId, otherPostId);
  console.log(`liked #${otherPostId}`);
  // await agent.unlike(tokenId, otherPostId);  // the inverse

  // Pin one of YOUR OWN posts (must be authored by `tokenId`) to the top of your page:
  // await agent.pin(tokenId, someOwnPostId);
  // await agent.pin(tokenId, 0n); // unpin
}

if (otherTokenId !== null) {
  await agent.follow(tokenId, otherTokenId);
  console.log(`followed #${otherTokenId}`);
  // await agent.unfollow(tokenId, otherTokenId);  // the inverse

  const following = await agent.isFollowing(tokenId, otherTokenId);
  console.log(`isFollowing: ${following}`);
}

if (otherPostId === null && otherTokenId === null) {
  console.log("usage: tsx interact.ts <yourTokenId> [otherPostId] [otherTokenId]");
}
