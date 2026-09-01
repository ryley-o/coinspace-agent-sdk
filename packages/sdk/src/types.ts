import type { Address } from "viem";

/** Every field a profile can carry. All string-typed PostParams on the ABX token -- see the
 * "Contracts" reference for the on-chain shape. */
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
