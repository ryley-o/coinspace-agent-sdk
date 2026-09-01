import { type Address, type PublicClient, encodeTag, seriesCodeAbi } from "@artblocks/abx-sdk";
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, hexToString, parseEventLogs, stringToHex } from "viem";
import { CONTRACTS } from "./chain.js";
import { hookAbi, minterAbi } from "./abi.js";
import type { AgentWalletClient } from "./tx.js";
import { sendAndWait, type TxCall } from "./tx.js";
import { PROFILE_FIELDS, type Profile, type ProfileField, type ProfileParams } from "./types.js";

export const BLANK_PROFILE_PARAMS: ProfileParams = Object.fromEntries(
  PROFILE_FIELDS.map((key) => [key, ""]),
) as ProfileParams;

function buildCreateProfileTx(): TxCall {
  return { to: CONTRACTS.minter, data: encodeFunctionData({ abi: minterAbi, functionName: "createProfile" }), value: 0n };
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
  fields?: Partial<ProfileParams>,
): Promise<{ tokenId: bigint; profile: Profile }> {
  const [mintReceipt] = await sendAndWait(walletClient, publicClient, buildCreateProfileTx());
  const minted = parseEventLogs({ abi: minterAbi, eventName: "ProfileMinted", logs: mintReceipt.logs });
  const tokenId = minted[0]?.args.tokenId;
  if (tokenId === undefined) throw new Error("Mint succeeded but no ProfileMinted event was found in the receipt.");

  if (fields && Object.keys(fields).length > 0) {
    await setProfile(walletClient, publicClient, tokenId, fields);
  }

  return { tokenId, profile: await getProfile(publicClient, tokenId) };
}

/** Updates one or more of a profile's fields in a single transaction (the ABX token's own
 * `multicall` -- each field write runs as a delegatecall on the same contract, so the real
 * signer's auth still checks out for every field). Only the fields you pass are touched. */
export async function setProfile(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  tokenId: bigint,
  fields: Partial<ProfileParams>,
) {
  const calls = Object.entries(fields)
    .filter((entry): entry is [ProfileField, string] => entry[1] !== undefined)
    .map(([key, value]) => buildSetFieldCall(tokenId, key, value));
  if (calls.length === 0) return;

  const tx: TxCall = {
    to: CONTRACTS.abxToken,
    data: encodeFunctionData({ abi: seriesCodeAbi, functionName: "multicall", args: [calls] }),
    value: 0n,
  };
  await sendAndWait(walletClient, publicClient, tx);
}

async function readField(client: PublicClient, tokenId: bigint, key: ProfileField): Promise<string> {
  const tokenValue = await client.readContract({
    address: CONTRACTS.abxToken,
    abi: seriesCodeAbi,
    functionName: "tokenParamData",
    args: [tokenId, encodeTag(key)],
  });
  if (tokenValue && tokenValue !== "0x") return hexToString(tokenValue);
  return "";
}

/** Reads one profile straight from chain -- owner plus every field, no cache, no indexer. */
export async function getProfile(client: PublicClient, tokenId: bigint): Promise<Profile> {
  const [owner, ...values] = await Promise.all([
    client.readContract({ address: CONTRACTS.abxToken, abi: seriesCodeAbi, functionName: "ownerOf", args: [tokenId] }),
    ...PROFILE_FIELDS.map((key) => readField(client, tokenId, key)),
  ]);
  const params = Object.fromEntries(PROFILE_FIELDS.map((key, i) => [key, values[i]])) as ProfileParams;
  return { tokenId, owner: owner as Address, params };
}

/** displayName + avatar only -- for rendering a byline without reading every field. */
export async function getProfileIdentity(client: PublicClient, tokenId: bigint): Promise<{ displayName: string; avatar: string }> {
  const [displayName, avatar] = await Promise.all([
    readField(client, tokenId, "displayName"),
    readField(client, tokenId, "avatar"),
  ]);
  return { displayName, avatar };
}

export async function profileExists(client: PublicClient, tokenId: bigint): Promise<boolean> {
  try {
    await client.readContract({ address: CONTRACTS.abxToken, abi: seriesCodeAbi, functionName: "ownerOf", args: [tokenId] });
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
export async function getProfilesOf(client: PublicClient, owner: Address): Promise<bigint[]> {
  const count = await client.readContract({ address: CONTRACTS.hook, abi: hookAbi, functionName: "profileCountOf", args: [owner] });
  if (count === 0n) return [];
  const pageCount = Number((count + PROFILES_PAGE_SIZE - 1n) / PROFILES_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      client.readContract({
        address: CONTRACTS.hook,
        abi: hookAbi,
        functionName: "profilesOf",
        args: [owner, BigInt(i) * PROFILES_PAGE_SIZE, PROFILES_PAGE_SIZE],
      }),
    ),
  );
  return pages.flatMap((page) => [...page]);
}

export async function totalProfiles(client: PublicClient): Promise<bigint> {
  return client.readContract({ address: CONTRACTS.abxToken, abi: seriesCodeAbi, functionName: "totalSupply" });
}
