import { type Hex, decodeErrorResult, parseAbi } from "viem";

// Every custom error a normal SDK call can realistically revert with, declared directly (same
// minimal-ABI-surface pattern as abi.ts) rather than importing an upstream ABI wholesale -- these
// are Solidity error *signatures*, stable regardless of which @artblocks/abx-sdk version happens
// to be installed. Selectors independently confirmed against the deployed bytecode with
// `cast sig "ErrorName()"` and, for NotParamAuthorized/TokenDoesNotExist specifically, against a
// real revert on Base mainnet.
const KNOWN_ERRORS = parseAbi([
  // ABX PostParam errors -- configureTokenParamData / multicall (setProfile, createProfile with fields)
  "error NotParamAuthorized()",
  "error InvalidParamValue()",
  "error InvalidParamKey()",
  "error ParamNotSet()",
  "error NoParamSchema()",
  "error EmptyParamValue()",
  "error InvalidParamSchema()",
  "error ParamHooksLocked()",
  "error ParamLockExpired()",
  "error ParamLockNotExtendable()",
  // ABX token-level errors -- createProfile / any token write
  "error TokenAlreadyExists()",
  "error MintingPaused()",
  "error MaxInvocationsReached()",
  "error NonexistentToken()",
  "error TokenDoesNotExist()",
  "error NotOwnerNorApproved()",
  "error Unauthorized()",
  // CoinSpaceBlog -- post/reply/repost/like/hide/pin
  "error InvalidPost()",
  "error NotProfileOwner()",
  "error PostNotFound()",
  "error AlreadyLiked()",
  "error NotLiked()",
  "error NotPostAuthor()",
  "error PostAlreadyHidden()",
  // CoinSpaceSocial -- follow/unfollow
  "error CannotFollowSelf()",
]);

export interface DecodedRevert {
  name: string;
  raw: Hex;
}

/** Best-effort decode of a revert's raw error data against the custom errors above. Returns null
 * for unrecognized data (an error this list doesn't know about) or no data at all -- common on
 * public RPCs, which don't always return revert data for a transaction that mined but reverted. */
export function decodeKnownError(data: Hex | undefined): DecodedRevert | null {
  if (!data || data === "0x") return null;
  try {
    const decoded = decodeErrorResult({ abi: KNOWN_ERRORS, data });
    return { name: decoded.errorName, raw: data };
  } catch {
    return null;
  }
}

/** Walks a thrown error (from a failed `publicClient.call`) looking for raw revert data in any of
 * the shapes viem's various error classes carry it in across versions -- `.data` directly, or
 * nested under `.cause`/`.details`. Returns undefined if none is found (the RPC genuinely didn't
 * return any, which is common and not itself a bug in the RPC). */
export function extractRevertData(err: unknown): Hex | undefined {
  let current: unknown = err;
  for (let i = 0; i < 6 && current; i++) {
    if (typeof current === "object" && current !== null) {
      const obj = current as Record<string, unknown>;
      if (typeof obj.data === "string" && obj.data.startsWith("0x") && obj.data.length >= 10) {
        return obj.data as Hex;
      }
      current = obj.cause;
      continue;
    }
    break;
  }
  return undefined;
}

/** The on-chain ordering of ABX's PostParam `AuthOption` enum (0-6), confirmed against the real
 * deployed AUTH_OPTIONS ordering used by `@artblocks/abx-sdk`/`abx-cli` to decode the exact same
 * values. `paramSchema()`'s `auth` field is this index -- e.g. `1` means `TokenOwner`, not
 * `Creator` (a mix-up that has caused real production misdiagnoses; see this package's README). */
export const AUTH_LABELS = [
  "Creator",
  "TokenOwner",
  "Address",
  "CreatorOrTokenOwner",
  "CreatorOrAddress",
  "TokenOwnerOrAddress",
  "CreatorOrTokenOwnerOrAddress",
] as const;

export function authLabel(auth: number): string {
  return AUTH_LABELS[auth] ?? `unknown auth option ${auth}`;
}
