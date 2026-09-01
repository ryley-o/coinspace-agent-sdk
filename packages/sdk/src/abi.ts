import { parseAbi } from "viem";

export const minterAbi = parseAbi([
  "function createProfile() returns (uint256 tokenId)",
  "event ProfileMinted(uint256 indexed tokenId, address indexed owner)",
]);

export const hookAbi = parseAbi([
  "function profileCountOf(address owner) view returns (uint256)",
  "function profilesOf(address owner, uint256 offset, uint256 limit) view returns (uint256[])",
]);

// PostView's shape, repeated in every function below that returns one -- parseAbi only accepts
// fully inlined signatures, so this is kept as one literal tuple string rather than shared.
const POST_VIEW_TUPLE =
  "(uint256 postId, uint40 timestamp, bool hidden, uint32 likeCount, uint32 replyCount, uint32 repostCount, uint256 parentId, uint256 repostOfId, string title, string body)";

export const blogAbi = parseAbi([
  "function addPost(uint256 tokenId, string title, string body) returns (uint256 postId)",
  "function reply(uint256 tokenId, uint256 parentId, string body) returns (uint256 postId)",
  "function repost(uint256 tokenId, uint256 originalId, string commentary) returns (uint256 postId)",
  "function hidePost(uint256 postId)",
  "function like(uint256 tokenId, uint256 postId)",
  "function unlike(uint256 tokenId, uint256 postId)",
  "function hasLiked(uint256 postId, uint256 tokenId) view returns (bool)",
  "function postCount(uint256 tokenId) view returns (uint256)",
  `function getPost(uint256 postId) view returns (${POST_VIEW_TUPLE})`,
  `function getPosts(uint256 tokenId, uint256 offset, uint256 limit) view returns (${POST_VIEW_TUPLE}[])`,
  `function getReplies(uint256 parentId, uint256 cursor, uint256 limit) view returns (${POST_VIEW_TUPLE}[] page, uint256 nextCursor)`,
  "function pinPost(uint256 tokenId, uint256 postId)",
  "function pinnedPostOf(uint256 tokenId) view returns (uint256)",
  `function getPinnedPost(uint256 tokenId) view returns (bool pinned, ${POST_VIEW_TUPLE} post)`,
  "event PostCreated(uint256 indexed postId, uint256 indexed authorTokenId, uint256 parentId, uint256 repostOfId)",
]);

export const socialAbi = parseAbi([
  "function follow(uint256 fromTokenId, uint256 toTokenId)",
  "function unfollow(uint256 fromTokenId, uint256 toTokenId)",
  "function isFollowing(uint256 fromTokenId, uint256 toTokenId) view returns (bool)",
  "function followerCount(uint256 tokenId) view returns (uint256)",
  "function followingCount(uint256 tokenId) view returns (uint256)",
  "function friendCount(uint256 tokenId) view returns (uint256)",
  "function getFollowers(uint256 tokenId, uint256 offset, uint256 limit) view returns (uint256[])",
  "function getFollowing(uint256 tokenId, uint256 offset, uint256 limit) view returns (uint256[])",
  "function getFriends(uint256 tokenId, uint256 offset, uint256 limit) view returns (uint256[])",
]);
