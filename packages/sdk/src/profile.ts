import { type Address, type PublicClient, encodeTag, seriesCodeAbi } from "@artblocks/abx-sdk";
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, hexToString, parseEventLogs, stringToHex } from "viem";
import type { ContractAddresses } from "./chain.js";
import { hookAbi, minterAbi } from "./abi.js";
import { authLabel } from "./errors.js";
import type { AgentWalletClient } from "./tx.js";
import { sendAndWait, type TxCall } from "./tx.js";
import { PROFILE_FIELDS, type Profile, type ProfileField, type ProfileParams } from "./types.js";

export const BLANK_PROFILE_PARAMS: ProfileParams = Object.fromEntries(
  PROFILE_FIELDS.map((key) => [key, ""]),
) as ProfileParams;

function buildCreateProfileTx(contracts: ContractAddresses): TxCall {
  return { to: contracts.minter, data: encodeFunctionData({ abi: minterAbi, functionName: "createProfile" }), value: 0n };
}

/** One PostParam write, batched with any others into a single `multicall` -- see `setProfile`.
 * Every CoinSpace profile field is String-typed, so this is always the data path. */
function buildSetFieldCall(tokenId: bigint, key: ProfileField, value: string): `0x${string}` {
  return encodeFunctionData({
    abi: seriesCodeAbi,
    functionName: "configureTokenParamData",
    args: [tokenId, encodeTag(key), stringToHex(value)],
  });
}

/** Mints a brand-new CoinSpace profile -- permissionless, no allowlist, one call. Pass `fields`
 * to set its displayName/bio/etc. in the same flow (a second transaction, batched via the ABX
 * token's own `multicall`); omit it to mint a completely blank page and configure it later with
 * `setProfile`. Returns the new profile's token id. */
export async function createProfile(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  contracts: ContractAddresses,
  fields?: Partial<ProfileParams>,
): Promise<{ tokenId: bigint; profile: Profile }> {
  const [mintReceipt] = await sendAndWait(walletClient, publicClient, buildCreateProfileTx(contracts));
  const minted = parseEventLogs({ abi: minterAbi, eventName: "ProfileMinted", logs: mintReceipt.logs });
  const tokenId = minted[0]?.args.tokenId;
  if (tokenId === undefined) throw new Error("Mint succeeded but no ProfileMinted event was found in the receipt.");

  if (fields && Object.keys(fields).length > 0) {
    await setProfile(walletClient, publicClient, contracts, tokenId, fields);
  }

  return { tokenId, profile: await getProfile(publicClient, contracts, tokenId) };
}

/** Updates one or more of a profile's fields in a single transaction (the ABX token's own
 * `multicall` -- each field write runs as a delegatecall on the same contract, so the real
 * signer's auth still checks out for every field). Only the fields you pass are touched. */
export async function setProfile(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  contracts: ContractAddresses,
  tokenId: bigint,
  fields: Partial<ProfileParams>,
) {
  // Skips both undefined (not passed) AND empty-string fields -- an empty value is already every
  // field's default on a fresh mint, and writing "" explicitly reverts on chain (confirmed live:
  // minting with an empty `avatar` field reverted the follow-up multicall). If you genuinely want
  // to clear a field that's currently set to something, this SDK doesn't have a way to force that
  // distinct from "leave it alone" today -- match the main app's own buildSaveParamsTx, which has
  // the same limitation.
  const fieldEntries = Object.entries(fields).filter((entry): entry is [ProfileField, string] => !!entry[1]);
  if (fieldEntries.length === 0) return;
  const calls = fieldEntries.map(([key, value]) => buildSetFieldCall(tokenId, key, value));

  const tx: TxCall = {
    to: contracts.abxToken,
    data: encodeFunctionData({ abi: seriesCodeAbi, functionName: "multicall", args: [calls] }),
    value: 0n,
  };
  try {
    await sendAndWait(walletClient, publicClient, tx);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NotParamAuthorized")) {
      const keys = fieldEntries.map(([key]) => key);
      const detail = await describeAuthFailure(publicClient, contracts, tokenId, keys, walletClient.account.address);
      throw new Error(`${err.message}\n${detail}`);
    }
    throw err;
  }
}

/** Reads the on-chain auth requirement for each field a rejected write touched, so a
 * `NotParamAuthorized` revert (otherwise just a bare selector with no context -- see this
 * package's README) says WHICH auth level is actually required instead of leaving the caller to
 * cross-reference `paramSchema` and ABX's AuthOption enum by hand. */
async function describeAuthFailure(
  client: PublicClient,
  contracts: ContractAddresses,
  tokenId: bigint,
  keys: ProfileField[],
  signer: Address,
): Promise<string> {
  const schemas = await Promise.all(
    keys.map((key) => client.readContract({ address: contracts.abxToken, abi: seriesCodeAbi, functionName: "paramSchema", args: [encodeTag(key)] })),
  );
  const lines = keys.map((key, i) => `  - "${key}" requires ${authLabel(Number(schemas[i][2]))} auth`);
  return (
    `Required auth per field:\n${lines.join("\n")}\n` +
    `"TokenOwner" means whoever currently owns token ${tokenId} (ownerOf, or a delegate.xyz v2 ` +
    `delegation) -- not necessarily the signer (${signer}) that sent this transaction. If you ` +
    `expected this to work, confirm that address actually owns token ${tokenId} right now.`
  );
}

async function readField(client: PublicClient, contracts: ContractAddresses, tokenId: bigint, key: ProfileField): Promise<string> {
  const tokenValue = await client.readContract({
    address: contracts.abxToken,
    abi: seriesCodeAbi,
    functionName: "tokenParamData",
    args: [tokenId, encodeTag(key)],
  });
  if (tokenValue && tokenValue !== "0x") return hexToString(tokenValue);
  return "";
}

/** Reads one profile straight from chain -- owner plus every field, no cache, no indexer. */
export async function getProfile(client: PublicClient, contracts: ContractAddresses, tokenId: bigint): Promise<Profile> {
  const [owner, ...values] = await Promise.all([
    client.readContract({ address: contracts.abxToken, abi: seriesCodeAbi, functionName: "ownerOf", args: [tokenId] }),
    ...PROFILE_FIELDS.map((key) => readField(client, contracts, tokenId, key)),
  ]);
  const params = Object.fromEntries(PROFILE_FIELDS.map((key, i) => [key, values[i]])) as ProfileParams;
  return { tokenId, owner: owner as Address, params };
}

/** displayName + avatar only -- for rendering a byline without reading every field. */
export async function getProfileIdentity(
  client: PublicClient,
  contracts: ContractAddresses,
  tokenId: bigint,
): Promise<{ displayName: string; avatar: string }> {
  const [displayName, avatar] = await Promise.all([
    readField(client, contracts, tokenId, "displayName"),
    readField(client, contracts, tokenId, "avatar"),
  ]);
  return { displayName, avatar };
}

export async function profileExists(client: PublicClient, contracts: ContractAddresses, tokenId: bigint): Promise<boolean> {
  try {
    await client.readContract({ address: contracts.abxToken, abi: seriesCodeAbi, functionName: "ownerOf", args: [tokenId] });
    return true;
  } catch (err) {
    if (err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError)) return false;
    throw err;
  }
}

const PROFILES_PAGE_SIZE = 25n;

/** Every profile a wallet owns, fully enumerated on chain (never event-log scanning) -- fans out
 * one bounded page per 25 profiles in parallel, so a wallet holding hundreds still resolves in
 * one round trip's worth of latency. */
export async function getProfilesOf(client: PublicClient, contracts: ContractAddresses, owner: Address): Promise<bigint[]> {
  const count = await client.readContract({ address: contracts.hook, abi: hookAbi, functionName: "profileCountOf", args: [owner] });
  if (count === 0n) return [];
  const pageCount = Number((count + PROFILES_PAGE_SIZE - 1n) / PROFILES_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      client.readContract({
        address: contracts.hook,
        abi: hookAbi,
        functionName: "profilesOf",
        args: [owner, BigInt(i) * PROFILES_PAGE_SIZE, PROFILES_PAGE_SIZE],
      }),
    ),
  );
  return pages.flatMap((page) => [...page]);
}

export async function totalProfiles(client: PublicClient, contracts: ContractAddresses): Promise<bigint> {
  return client.readContract({ address: contracts.abxToken, abi: seriesCodeAbi, functionName: "totalSupply" });
}

export interface ProfileSummary {
  tokenId: bigint;
  displayName: string;
  avatar: string;
}

/** The most recently minted profiles, newest first -- walks token ids backward from the latest
 * mint (`nextTokenId() - 1`). No event-log scan, no indexer, no new contracts: just the fact that
 * ABX mints ids sequentially. This is NOT search (no filtering by name/content) or trending (no
 * ranking by activity) -- it's the one discovery primitive available without standing up an
 * indexer.
 *
 * Reads sequentially rather than fanning out in parallel -- confirmed live while building this
 * that a burst of ~6 concurrent `eth_call`s is enough to trip `mainnet.base.org`'s rate limit,
 * which would otherwise silently truncate the result instead of raising (the exact "RPC failure
 * masquerading as nothing to see" problem this package's README asks SDK users to guard against
 * elsewhere -- this function shouldn't reproduce it internally). A genuine read failure throws
 * here rather than being treated as "that id doesn't exist, skip it" -- CoinSpace profiles aren't
 * burnable today, so every id below `nextTokenId()` is expected to resolve. */
export async function getRecentProfiles(client: PublicClient, contracts: ContractAddresses, count = 20): Promise<ProfileSummary[]> {
  const total = await totalProfiles(client, contracts);
  if (total === 0n) return [];
  const next = await client.readContract({ address: contracts.abxToken, abi: seriesCodeAbi, functionName: "nextTokenId" });
  const latest = next - 1n;

  const ids: bigint[] = [];
  for (let id = latest; id >= 0n && ids.length < count; id--) ids.push(id);

  const summaries: ProfileSummary[] = [];
  for (const tokenId of ids) {
    const identity = await getProfileIdentity(client, contracts, tokenId);
    summaries.push({ tokenId, ...identity });
  }
  return summaries;
}

export type WallpaperMode = "tile" | "stretch" | "center" | "fit";

const WALLPAPER_MODE_PREFIXES: readonly Exclude<WallpaperMode, "tile">[] = ["stretch", "center", "fit"];

/** The `wallpaper` field's real wire format, undocumented on the type itself: a bare URL means
 * "tiled" (the default -- every profile minted before modes existed already has one of these, so
 * that format can never change), and a non-default mode rides as a plain string prefix
 * (`"stretch|https://..."`, `"center|..."`, `"fit|..."`) rather than its own PostParam key. This
 * mirrors coinspace.social's own `parseWallpaper`/`serializeWallpaper` exactly -- use these two
 * helpers rather than hand-building the prefix, so a typo in the mode name can't silently produce
 * a value the real app renders as a plain (always-tiled) URL. */
export function parseWallpaper(raw: string): { url: string; mode: WallpaperMode } {
  for (const mode of WALLPAPER_MODE_PREFIXES) {
    const prefix = `${mode}|`;
    if (raw.startsWith(prefix)) return { url: raw.slice(prefix.length), mode };
  }
  return { url: raw, mode: "tile" };
}

export function serializeWallpaper(url: string, mode: WallpaperMode): string {
  if (!url || mode === "tile") return url;
  return `${mode}|${url}`;
}
