#!/usr/bin/env node
import { Command } from "commander";
import { formatEther } from "viem";
import { getAgent } from "./wallet.js";
import { printJson, timeAgo } from "./output.js";

const program = new Command();

program
  .name("coinspace")
  .description(
    "CLI for the CoinSpace on-chain social protocol. Create a profile, post, reply, repost, " +
      "like, follow -- all signed by your own wallet key, sent directly to Base Sepolia over " +
      "RPC. No API, no server, nothing to authenticate with except your key.\n\n" +
      "Set COINSPACE_PRIVATE_KEY once (a 0x-prefixed private key) and every write command uses " +
      "it to sign. Read commands (profile, posts, feed, social) work without a key at all.",
  )
  .version("0.1.0")
  .option("--key <hex>", "private key to sign with (overrides COINSPACE_PRIVATE_KEY)")
  .option("--rpc-url <url>", "override the default public Base Sepolia RPC")
  .option("--json", "print machine-readable JSON instead of formatted text");

function opts() {
  return program.opts<{ key?: string; rpcUrl?: string; json?: boolean }>();
}

function agent(requireKey: boolean) {
  const o = opts();
  return getAgent({ key: o.key, rpcUrl: o.rpcUrl }, { requireKey });
}

function fail(err: unknown): never {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------

program
  .command("whoami")
  .description("show your wallet address, ETH balance, and the profiles you own")
  .action(async () => {
    try {
      const a = agent(true);
      const [balance, profiles] = await Promise.all([a.publicClient.getBalance({ address: a.address }), a.getProfilesOf()]);
      if (opts().json) return printJson({ address: a.address, balanceEth: formatEther(balance), profiles });
      console.log(`address:  ${a.address}`);
      console.log(`balance:  ${formatEther(balance)} ETH (Base Sepolia)`);
      console.log(`profiles: ${profiles.length === 0 ? "none yet -- try `coinspace create-profile`" : profiles.join(", ")}`);
    } catch (err) {
      fail(err);
    }
  });

function profileFieldOptions(cmd: Command) {
  return cmd
    .option("--display-name <name>", "display name")
    .option("--bio <text>", "bio")
    .option("--avatar <url>", "avatar image URL (https:// or ipfs://)")
    .option("--song <url>", "a spotify or youtube link")
    .option("--wallpaper <url>", "wallpaper image URL, tiled behind the page (https:// or ipfs://)")
    .option("--css <css>", "custom CSS styling the bio/images/top8 canvas -- see the Profile Design docs")
    .option("--widget-theme-bg <hex>", "background color for the song/widget panels, e.g. #e6dfc4")
    .option("--widget-theme-border <hex>", "border color for the song/widget panels, e.g. #0a0a0a");
}

interface ProfileFieldOpts {
  displayName?: string;
  bio?: string;
  avatar?: string;
  song?: string;
  wallpaper?: string;
  css?: string;
  widgetThemeBg?: string;
  widgetThemeBorder?: string;
}

function fieldsFromOpts(o: ProfileFieldOpts) {
  const fields: Record<string, string> = {};
  if (o.displayName !== undefined) fields.displayName = o.displayName;
  if (o.bio !== undefined) fields.bio = o.bio;
  if (o.avatar !== undefined) fields.avatar = o.avatar;
  if (o.song !== undefined) fields.song = o.song;
  if (o.wallpaper !== undefined) fields.wallpaper = o.wallpaper;
  if (o.css !== undefined) fields.css = o.css;
  // widgetTheme is one PostParam, JSON {bg, border} -- pass either half and the other stays "".
  if (o.widgetThemeBg !== undefined || o.widgetThemeBorder !== undefined) {
    fields.widgetTheme = JSON.stringify({ bg: o.widgetThemeBg ?? "", border: o.widgetThemeBorder ?? "" });
  }
  return fields;
}

profileFieldOptions(
  program
    .command("create-profile")
    .description("mint a brand-new profile -- permissionless, no allowlist, one transaction (plus one more if you pass any field)"),
).action(async (o) => {
  try {
    const a = agent(true);
    const { tokenId, profile } = await a.createProfile(fieldsFromOpts(o));
    if (opts().json) return printJson({ tokenId, profile });
    console.log(`created profile #${tokenId}`);
    if (profile.params.displayName) console.log(`display name: ${profile.params.displayName}`);
    console.log(`view it (once the app is live) at /p/${tokenId}`);
  } catch (err) {
    fail(err);
  }
});

program
  .command("profile <tokenId>")
  .description("show a profile's fields (read-only, no key needed)")
  .action(async (tokenId: string) => {
    try {
      const a = agent(false);
      const profile = await a.getProfile(BigInt(tokenId));
      if (opts().json) return printJson(profile);
      console.log(`#${profile.tokenId}  owner ${profile.owner}`);
      for (const [key, value] of Object.entries(profile.params)) {
        if (value) console.log(`${key}: ${value}`);
      }
    } catch (err) {
      fail(err);
    }
  });

profileFieldOptions(
  program.command("set-profile <tokenId>").description("update one or more fields on a profile you own"),
).action(async (tokenId: string, o) => {
  try {
    const a = agent(true);
    const fields = fieldsFromOpts(o);
    if (Object.keys(fields).length === 0) throw new Error("Pass at least one field to update, e.g. --bio 'hello'.");
    await a.setProfile(BigInt(tokenId), fields);
    if (opts().json) return printJson({ tokenId, updated: Object.keys(fields) });
    console.log(`updated ${Object.keys(fields).join(", ")} on profile #${tokenId}`);
  } catch (err) {
    fail(err);
  }
});

program
  .command("profiles-of [address]")
  .description("list every profile a wallet owns (defaults to your own address)")
  .action(async (address?: string) => {
    try {
      const a = agent(!address);
      const owner = (address ?? a.address) as `0x${string}`;
      const profiles = await a.getProfilesOf(owner);
      if (opts().json) return printJson({ owner, profiles });
      console.log(profiles.length === 0 ? "no profiles" : profiles.map((id) => `#${id}`).join(", "));
    } catch (err) {
      fail(err);
    }
  });

// ---------------------------------------------------------------------------------------------

program
  .command("post <tokenId> <title> <body>")
  .description("publish a new post from a profile you own")
  .action(async (tokenId: string, title: string, body: string) => {
    try {
      const a = agent(true);
      const postId = await a.post(BigInt(tokenId), title, body);
      if (opts().json) return printJson({ postId });
      console.log(`posted -- id ${postId}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("reply <tokenId> <parentPostId> <body>")
  .description("reply to a post")
  .action(async (tokenId: string, parentPostId: string, body: string) => {
    try {
      const a = agent(true);
      const postId = await a.reply(BigInt(tokenId), BigInt(parentPostId), body);
      if (opts().json) return printJson({ postId });
      console.log(`replied -- id ${postId}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("repost <tokenId> <originalPostId> [commentary]")
  .description("repost something, with optional commentary of your own")
  .action(async (tokenId: string, originalPostId: string, commentary?: string) => {
    try {
      const a = agent(true);
      const postId = await a.repost(BigInt(tokenId), BigInt(originalPostId), commentary ?? "");
      if (opts().json) return printJson({ postId });
      console.log(`reposted -- id ${postId}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("like <tokenId> <postId>")
  .description("like a post, as one of your profiles")
  .action(async (tokenId: string, postId: string) => {
    try {
      await agent(true).like(BigInt(tokenId), BigInt(postId));
      console.log("liked");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("unlike <tokenId> <postId>")
  .description("undo a like")
  .action(async (tokenId: string, postId: string) => {
    try {
      await agent(true).unlike(BigInt(tokenId), BigInt(postId));
      console.log("unliked");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("hide <postId>")
  .description("hide one of your own posts (moderation, not deletion -- the text stays readable directly on chain)")
  .action(async (postId: string) => {
    try {
      await agent(true).hide(BigInt(postId));
      console.log("hidden");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("pin <tokenId> <postId>")
  .description("pin one of your own posts to the top of your page")
  .action(async (tokenId: string, postId: string) => {
    try {
      await agent(true).pin(BigInt(tokenId), BigInt(postId));
      console.log("pinned");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("unpin <tokenId>")
  .description("clear whatever is currently pinned")
  .action(async (tokenId: string) => {
    try {
      await agent(true).pin(BigInt(tokenId), 0n);
      console.log("unpinned");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("posts <tokenId>")
  .description("list a profile's recent posts (read-only, no key needed)")
  .option("--count <n>", "how many to fetch", "20")
  .action(async (tokenId: string, o: { count: string }) => {
    try {
      const a = agent(false);
      const { posts, hasMore } = await a.getPosts(BigInt(tokenId), Number(o.count));
      if (opts().json) return printJson({ posts, hasMore });
      if (posts.length === 0) console.log("no posts");
      for (const p of posts) {
        const kind = p.parentId !== 0n ? "reply" : p.repostOfId !== 0n ? "repost" : "post";
        console.log(`#${p.postId}  [${kind}]  ${timeAgo(p.timestamp)}  ♥${p.likeCount} ↩${p.replyCount} ⟲${p.repostCount}`);
        if (p.title) console.log(`  ${p.title}`);
        if (p.body) console.log(`  ${p.body.slice(0, 200)}${p.body.length > 200 ? "…" : ""}`);
      }
      if (hasMore) console.log(`\n(more available -- see agent.getMorePosts in the SDK docs)`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("replies <postId>")
  .description("list a post's top replies, ranked by likes (read-only, no key needed)")
  .option("--limit <n>", "how many to fetch", "25")
  .action(async (postId: string, o: { limit: string }) => {
    try {
      const a = agent(false);
      const { replies, nextCursor } = await a.getReplies(BigInt(postId), 0n, Number(o.limit));
      if (opts().json) return printJson({ replies, nextCursor });
      if (replies.length === 0) console.log("no replies");
      for (const r of replies) {
        console.log(`#${r.postId}  ${timeAgo(r.timestamp)}  ♥${r.likeCount}`);
        console.log(`  ${r.body.slice(0, 200)}${r.body.length > 200 ? "…" : ""}`);
      }
    } catch (err) {
      fail(err);
    }
  });

program
  .command("feed <tokenId>")
  .description("the timeline of everyone a profile follows, ranked by recency + engagement (read-only, no key needed)")
  .action(async (tokenId: string) => {
    try {
      const a = agent(false);
      const feed = await a.getFeed(BigInt(tokenId));
      if (opts().json) return printJson(feed);
      if (feed.length === 0) console.log("nothing yet -- follow some profiles first");
      for (const entry of feed) {
        console.log(`${entry.authorName || `#${entry.authorTokenId}`}  ${timeAgo(entry.post.timestamp)}  (post #${entry.post.postId})`);
        if (entry.post.title) console.log(`  ${entry.post.title}`);
        console.log(`  ${entry.post.body.slice(0, 200)}${entry.post.body.length > 200 ? "…" : ""}\n`);
      }
    } catch (err) {
      fail(err);
    }
  });

// ---------------------------------------------------------------------------------------------

program
  .command("follow <fromTokenId> <toTokenId>")
  .description("follow a profile, as one of your own profiles")
  .action(async (fromTokenId: string, toTokenId: string) => {
    try {
      await agent(true).follow(BigInt(fromTokenId), BigInt(toTokenId));
      console.log("followed");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("unfollow <fromTokenId> <toTokenId>")
  .description("unfollow a profile")
  .action(async (fromTokenId: string, toTokenId: string) => {
    try {
      await agent(true).unfollow(BigInt(fromTokenId), BigInt(toTokenId));
      console.log("unfollowed");
    } catch (err) {
      fail(err);
    }
  });

program
  .command("social <tokenId>")
  .description("a profile's follower/following/friend counts and samples (read-only, no key needed)")
  .action(async (tokenId: string) => {
    try {
      const a = agent(false);
      const s = await a.getSocialSummary(BigInt(tokenId));
      if (opts().json) return printJson(s);
      console.log(`followers: ${s.followerCount}  (${s.followers.join(", ") || "none"})`);
      console.log(`following: ${s.followingCount}  (${s.following.join(", ") || "none"})`);
      console.log(`friends:   ${s.friendCount}  (${s.friends.join(", ") || "none"})`);
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync(process.argv).catch(fail);
