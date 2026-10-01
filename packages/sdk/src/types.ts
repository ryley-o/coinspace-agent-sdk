import type { Address } from "viem";

/** Every field a profile can carry. All string-typed PostParams on the ABX token. The wire format
 * of each is NOT just "a string" -- see the [Profile Design](https://docs.coinspace.social/design)
 * doc page (or the `coinspace-design` skill) for the complete, authoritative spec: `wallpaper`'s
 * `stretch|`/`center|`/`fit|` mode prefix (`parseWallpaper`/`serializeWallpaper`, exported from
 * `./profile.js`, implement it for you), `widgets`' JSON array shape and host allowlist, `song`'s
 * accepted URL formats, and the real (non-enforced-on-chain) `css` length convention. Don't guess
 * these from reading other profiles' on-chain values -- the design doc is the source of truth and
 * is more complete than what's reverse-engineerable from chain state alone. */
export const PROFILE_FIELDS = ["displayName", "bio", "avatar", "song", "css", "wallpaper", "widgets", "widgetTheme"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileParams = { [K in ProfileField]: string };

export interface Profile {
  tokenId: bigint;
  owner: Address;
  params: ProfileParams;
}

/** A post is exactly one of three shapes -- a base post, a reply (`parentId` set), or a repost
 * (`repostOfId` set) -- unified into one type, matching CoinSpaceBlog.sol's own model. */
export interface Post {
  postId: bigint;
  index: number;
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

export interface FollowLists {
  followers: bigint[];
  following: bigint[];
  friends: bigint[];
}

export interface SocialSummary extends FollowLists {
  followerCount: number;
  followingCount: number;
  friendCount: number;
}

export interface FeedEntry {
  authorTokenId: bigint;
  authorName: string;
  authorAvatar: string;
  post: Post;
}
